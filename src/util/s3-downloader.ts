import fs, {PathLike} from "fs";
import Promise from "bluebird";
import {promises as fsPromises} from "fs";
import IFileDownloader from "./file-downloader";
import {DownloadFile, DownloadFilesJob} from "../common/types";
import * as stream from "stream";
import * as aws from "aws-sdk"
import {GetObjectRequest} from "aws-sdk/clients/s3";
import {Readable} from "stream";

class S3Downloader implements IFileDownloader {
    assertFiles(downloadJob: DownloadFilesJob): Promise<void> {
        const workingDir = this.assertWorkingDirectory(downloadJob.basePath, downloadJob.container);

        let filePromises: Promise<string>[] = [];
        downloadJob.files.forEach((file) => filePromises.push(this.assertFile(workingDir, file)));
        return new Promise<void>((resolve, reject) =>
            Promise.all(filePromises)
            .then(() => resolve())
            .catch(() => reject())
        );
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
        return new Promise<string>((resolve, reject) => {
            S3Downloader.fileExists(filePath)
                .then(fileExists => {
                    if (fileExists) {
                        resolve(filePath);
                    } else {
                        this.getS3Stream(downloadFile.source)
                            .then((readStream) => {return fsPromises.writeFile(filePath, readStream)})
                            .then(() => resolve(filePath))
                    }
                })
                .catch(error => reject(error));
        });
    }

    static fileExists(file: PathLike): Promise<boolean> {
        return new Promise<boolean>((resolve, reject) => {
            fsPromises.stat(file)
                .then((stats) => {
                    if (stats.isFile()) {
                        resolve(true)
                    } else {
                        reject('Path Exists but is not file.')
                    }
                }).catch(() => resolve(false));
        });
    }

    getS3Stream(s3Url: string): Promise<stream.Readable> {
        return new Promise<stream.Readable>((resolve, reject) => {
            const s3ObjectRequest = S3Downloader.s3ObjectRequest(s3Url);
            new aws.S3().getObject(s3ObjectRequest, (err, data) => {
                if(err){
                    reject(err);
                } else{
                    resolve(data.Body as Readable);
                }
            });
        });
    }

    static s3ObjectRequest(s3Url: string): GetObjectRequest {
        const url = new URL(s3Url);
        return {
            Bucket: url.host,
            Key: url.pathname.substr(1)
        };
    }

}

export default S3Downloader;
