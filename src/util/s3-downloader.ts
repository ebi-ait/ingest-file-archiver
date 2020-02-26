import fs, {PathLike} from "fs";
import Promise from "bluebird";
import {promises as fsPromises} from "fs";
import IFileDownloader from "./file-downloader";
import {DownloadFile, DownloadFilesJob} from "../common/types";
import * as stream from "stream";
import {GetObjectRequest} from "aws-sdk/clients/s3";
import {S3} from "aws-sdk";

class S3Downloader implements IFileDownloader {
    private s3Instance: S3;

    constructor(s3Instance: S3) {
        this.s3Instance = s3Instance;
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
            return this.getS3Stream(downloadFile.source)
                .then((readStream) => S3Downloader.writeFile(readStream, filePath))
                .return(filePath)
        }
    }

    getS3Stream(s3Url: string): Promise<stream.Readable> {
        return new Promise<stream.Readable>((resolve, reject) => {
            const s3ObjectRequest = S3Downloader.s3ObjectRequest(s3Url);
            this.s3Instance.getObject(s3ObjectRequest)
                .promise()
                .then(() => resolve(this.s3Instance.getObject(s3ObjectRequest).createReadStream()))
                .catch(error => reject(error));
        });
    }

    private static writeFile(readStream: stream.Readable, filePath: string) {
        return new Promise<void>((resolve, reject) => {
            const writeStream = fs.createWriteStream(filePath);
            readStream.pipe(writeStream);
            readStream
                .on("end", () => {
                    writeStream.end();
                    resolve();
                })
                .on("error", (err) => reject(err));
        });
    }

    private static s3ObjectRequest(s3Url: string): GetObjectRequest {
        const url = new URL(s3Url);
        return {
            Bucket: url.host,
            Key: url.pathname.substr(1)
        };
    }

    static default() {
        return new S3Downloader(new S3());
    }
}

export default S3Downloader;
