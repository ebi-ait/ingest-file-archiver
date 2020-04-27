/***
 *
 * Wrapper class around the hca command line tool for downloading bundles
 */

import Promise from "bluebird";
import {exec} from "child_process";
import {DownloadBundleFilesJob} from "../common/types";
import fs from "fs";
import R from "ramda";

class BundleDownloader {
    hcaCliPath: string;

    constructor(hcaCliPath: string) {
        this.hcaCliPath = hcaCliPath;
    }

    assertFiles(downloadJob: DownloadBundleFilesJob): Promise<void> {
        console.log(`Starting Downloading ${downloadJob.files.length} files from dcp for manifest ${downloadJob.container}`)
        const workingDir = this.assertWorkingDirectory(downloadJob.basePath, downloadJob.container);
        const fileNames: string[] = R.map((file) => file.fileName, downloadJob.files);
        return this._getBundleVersion(downloadJob.bundleUuid)
            .then((bundleVersion :string) => this._assertBundleFiles(downloadJob.basePath, downloadJob.bundleUuid, bundleVersion, fileNames))
            .then((uuidVersion :string) => this._linkFiles(downloadJob.basePath + '/' + uuidVersion, workingDir, fileNames))
            .then(() => console.log(`Finished Downloading & Linking ${downloadJob.files.length} files from dcp for manifest ${downloadJob.container}`));
    }

    assertWorkingDirectory(basePath: string, container: string): string {
        const workingDir = basePath + '/' + container;
        if (!fs.existsSync(workingDir)) {
            fs.mkdirSync(workingDir);
        }
        return workingDir;
    }

    private _getBundleVersion(bundleUuid: string): Promise<string> {
        return new Promise<string>((resolve, reject) => {
            const command : string = `${this.hcaCliPath} dss get-bundle --uuid ${bundleUuid} --replica aws`
            console.log(`Bundle Version Command: ${command}`)
            exec(command, (error, stdout, stderr) => {
                if (error) {
                    console.error(`Bundle Version Error: ${error}`);
                    reject(error)
                }
                const bundleVersion = JSON.parse(stdout).bundle.version;
                resolve(bundleVersion)
            });
        });
    }

    _assertBundleFiles(workingDir: string, bundleUuid: string, bundleVersion: string, files: string[]): Promise<string> {
        let fileNames: string = files.join(' ');
        return new Promise<string>((resolve, reject) => {
            const command : string = `${this.hcaCliPath} dss download --bundle-uuid ${bundleUuid} --version ${bundleVersion} --replica aws --no-metadata --data-filter ${fileNames}`
            console.log(`Bundle Files Command: ${command}`)
            exec(command, {cwd: workingDir},(error, stdout, stderr)=> {
                if (error) {
                    console.error(`Bundle Files Error: ${error}`);
                    reject(error)
                }
                resolve(`${bundleUuid}.${bundleVersion}`)
            });
        });
    }

    private _linkFiles(sourceDir: string, destinationDir: string, files: string[]): Promise<void> {
        let linkPromises: any[] = [];
        files.forEach((file) => {
            const sourceFile = sourceDir + '/' + file;
            const destinationFile = destinationDir + '/' + file;
            if (fs.existsSync(destinationFile)) {
                console.log(`Deleting Existing link: ${destinationFile}`);
                fs.unlinkSync(destinationFile);
            }
            console.log(`Creating new link: ${destinationFile} -> ${sourceFile}`);
            linkPromises.push(fs.promises.link(sourceFile, destinationFile));
        });
        return Promise.all(linkPromises).thenReturn();
    }
}

export default BundleDownloader;
