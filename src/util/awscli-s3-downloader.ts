import fs from "fs";
import Promise from "bluebird";
import {DownloadFile, DownloadS3FilesJob} from "../common/types";
import {ChildProcess, exec, ExecException} from "child_process";


class AwsCliS3Downloader {
    constructor() {
    }

    assertFiles(downloadJob: DownloadS3FilesJob): Promise<void> {
        console.log("Downloading files from s3...")
        const workingDir = this.assertWorkingDirectory(downloadJob.basePath, downloadJob.container);

        let filePromises: Promise<string>[] = [];
        downloadJob.files.forEach((file) => filePromises.push(this.assertFile(workingDir, file)));
        console.log('length of promises', filePromises.length);
        return Promise.all(filePromises)
            .then(() => {
                console.log("Downloading finished!")
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
            return new Promise<string>((resolve, reject) => {
                const command: string = `aws s3 cp ${downloadFile.source} ${filePath} --no-progress`
                console.log(`Download Files Command: ${command}`)
                const awsCli = this.execCommand(command, undefined,
                    (error, stdout, stderr) => {
                        if (error) {
                            console.error(`Download Files Error: ${error}`);
                            reject(error)
                        }
                        resolve(filePath)
                    });
                awsCli.stderr.pipe(process.stdout);
            });
        }
    }

    execCommand(command: string, cwd?: string, callback?: (error: ExecException | null, stdout: string, stderr: string) => void): ChildProcess {
        if (cwd) {
            return exec(command, {cwd: cwd}, callback);
        }
        return exec(command, callback);
    }
}

export default AwsCliS3Downloader;

