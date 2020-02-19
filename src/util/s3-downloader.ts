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
    config: AWS.Config;
    constructor(awsConfig: AWS.Config) {
        this.config = awsConfig;
    }

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
            this.fileExists(filePath)
                .then(fileExists => {
                    if (fileExists) {
                        resolve(filePath);
                    } else {
                        this.downloadFile(filePath, new URL (downloadFile.source)).then(() => resolve(filePath))
                    }
                })
                .catch(error => reject(error));
        });
    }

    fileExists(file: PathLike): Promise<boolean> {
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

    downloadFile(filePath: string, s3Location: URL): Promise<void> {
        return this.fetchS3(s3Location)
            .then((readStream) => {return fsPromises.writeFile(filePath, readStream)})
    }

    fetchS3(s3Url: URL): Promise<stream.Readable> {
        const getObjRequest: GetObjectRequest = {
            Bucket: s3Url.host,
            Key: s3Url.pathname
        };

        return new Promise<stream.Readable>((resolve, reject) => {
            new aws.S3(this.config).getObject(getObjRequest, (err, data) => {
                if(err){
                    reject(err);
                } else{
                    resolve(data.Body as Readable);
                }
            });
        });
    }
}
