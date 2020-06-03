import fs from "fs";
import Promise from "bluebird";
import {DownloadFile, DownloadS3FilesJob} from "../common/types";
import * as stream from "stream";
import {GetObjectRequest} from "aws-sdk/clients/s3";
import {S3} from "aws-sdk";
import HttpRange from "./http-range";

const RANGE_SIZE = 30000000; // 30 MB

interface S3StreamResponse {
    read: stream.Readable,
    next: boolean
}


class S3Downloader {
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

    assertFiles(downloadJob: DownloadS3FilesJob): Promise<void> {
        console.log("Downloading files from s3...")
        const workingDir = this.assertWorkingDirectory(downloadJob.basePath, downloadJob.container);

        let filePromises: Promise<string>[] = [];
        downloadJob.files.forEach((file) => filePromises.push(this.assertFile(workingDir, file)));
        return Promise.all(filePromises)
            .then(() => {
                console.log('Donwloading finished!')
            });
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
            return Promise.resolve(filePath)
        } else {
            let start: number = 0;
            let end: number = start + RANGE_SIZE;
            const range: HttpRange = new HttpRange(start, end);
            return this.multipartDownload(downloadFile.source, range, filePath);
        }
    }

    /*
        Implements multipart downloading by specifying HttpRange param in the GetObject requests
        More details in https://docs.aws.amazon.com/AmazonS3/latest/API/API_GetObject.html#API_GetObject_RequestSyntax
    */
    multipartDownload(source: string, range: HttpRange, filePath: string): Promise<string> {
        return new Promise<string>((resolve, reject) => {
            this.getS3Stream(source, range)
                .then((data) => {
                    return S3Downloader.writeFile(data, filePath);
                })
                .then((data) => {
                    if (!data.next) {
                        resolve(filePath)
                    } else {
                        this.multipartDownload(source, range.next(), filePath);
                    }
                })
                .catch(error => {
                    reject(error);
                });
        });
    }

    getS3Stream(source: string, range: HttpRange): Promise<S3StreamResponse> {
        const s3ObjectRequest = S3Downloader.s3ObjectRequest(source, range);
        return new Promise<S3StreamResponse>((resolve, reject) => {
            this.s3Instance.getObject(s3ObjectRequest)
                .promise()
                .then((data) => {

                    // The "Content-Range" header field is sent in the GetObject response when HttpRange param is set
                    // This indicates the partial range of object enclosed as the message payload
                    // e.g. Content-Range: bytes 42-1233/1234
                    // The complete length of selected representation is known by the sender to be 1234 bytes
                    const contentRange: string = data.ContentRange || '';
                    const size: number = Number(contentRange.split('/')[1]);

                    resolve({
                        read: this.s3Instance.getObject(s3ObjectRequest).createReadStream(),
                        next: size > range.getEnd()
                    });
                })
                .catch(error => Promise.reject(error))


        });
    }
}

export default S3Downloader;

