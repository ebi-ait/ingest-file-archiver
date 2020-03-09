import fs from "fs";
import Promise from "bluebird";
import IFileDownloader from "./file-downloader";
import {DownloadFile, DownloadFilesJob} from "../common/types";
import * as stream from "stream";
import {GetObjectRequest} from "aws-sdk/clients/s3";
import {S3} from "aws-sdk";
import HttpRange from "./http-range";

const RANGE_SIZE = 30000000;

interface S3StreamResponse {
    read: stream.Readable,
    next: boolean
}

class S3Downloader implements IFileDownloader {
    private s3Instance: S3;

    constructor(s3Instance: S3) {
        this.s3Instance = s3Instance;
    }

    static default() {
        return new S3Downloader(new S3());
    }

    private static writeFile(data: S3StreamResponse, filePath: string): Promise<S3StreamResponse> {
        const readStream: stream.Readable = data.read;
        const writeStream = fs.createWriteStream(filePath, {flags: 'a'});
        return new Promise<S3StreamResponse>((resolve, reject) => {
            readStream.pipe(writeStream);
            readStream
                .on("end", () => {
                    writeStream.end();
                    resolve(data);
                })
                .on("error", (err) => reject(err));
        });
    }

    private static s3ObjectRequest(s3Url: string, httpRange: HttpRange): GetObjectRequest {
        const url = new URL(s3Url);
        return {
            Bucket: url.host,
            Key: url.pathname.substr(1),
            Range: httpRange.toString()
        };
    }

    assertFiles(downloadJob: DownloadFilesJob): Promise<void> {
        const workingDir = this.assertWorkingDirectory(downloadJob.basePath, downloadJob.container);

        let filePromises: Promise<string>[] = [];
        downloadJob.files.forEach((file) => filePromises.push(this.assertFile(workingDir, file)));
        return Promise.all(filePromises).return();
    }

    assertWorkingDirectory(basePath: string, container: string): string {
        const workingDir = basePath + '/' + container;
        if (!fs.existsSync(workingDir)) {
            fs.mkdirSync(workingDir);
        }
        return workingDir;
    }

    assertFile(workingDir: string, downloadFile: DownloadFile): Promise<string> {
        const filePath = workingDir + '/' + downloadFile.fileName;
        if (fs.existsSync(filePath)) {
            return Promise.resolve(filePath);
        } else {
            let start: number = 0;
            let rangeSize: number = RANGE_SIZE;
            let end: number = start + rangeSize;
            const range: HttpRange = new HttpRange(start, end); // "bytes=0-8191";
            return this.multiDownload(downloadFile.source, range, filePath);
        }
    }

    multiDownload(source: string, range: HttpRange, filePath: string): Promise<string> {
        return new Promise<string>((resolve, reject) => {
            this.getS3Stream(source, range)
                .then((data) => {
                    return S3Downloader.writeFile(data, filePath);
                })
                .then( (data) => {
                    if (!data.next) {
                        Promise.resolve(filePath)
                    } else {
                        this.multiDownload(source, range.next(), filePath);
                    }
                })
                .catch(error => {
                Promise.reject(error);
            });
        });
    }

    getS3Stream(source: string, range: HttpRange): Promise<S3StreamResponse> {
        const s3ObjectRequest = S3Downloader.s3ObjectRequest(source, range);
        return new Promise<S3StreamResponse>((resolve, reject) => {
            this.s3Instance.getObject(s3ObjectRequest)
                .promise()
                .then((data) => {
                    const contentRange: string = data.ContentRange || '';
                    const contentLength: number = data.ContentLength || 0;
                    const size: number = Number(contentRange.split('/')[1]);
                    let response: S3StreamResponse;
                    if (size > range.getEnd()) {
                        response = {
                            read: this.s3Instance.getObject(s3ObjectRequest).createReadStream(),
                            next: true
                        };
                    } else {
                        response = {
                            read: this.s3Instance.getObject(s3ObjectRequest).createReadStream(),
                            next: false
                        };
                    }
                    resolve(response);
                })
                .catch(error => Promise.reject(error))


        });
    }
}

export default S3Downloader;

