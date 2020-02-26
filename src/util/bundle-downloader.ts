/***
 *
 * Wrapper class around the hca command line tool for downloading bundles
 */

import Promise from "bluebird";
import {spawn} from "child_process";
import {BundleDownloadParams, BundleDownloadRequest, DownloadFilesJob} from "../common/types";
import FileExistenceChecker from "./file-existence-checker";
import IFileDownloader from "./file-downloader";

class BundleDownloader implements IFileDownloader {
    hcaCliPath: string;

    constructor(hcaCliPath: string) {
        this.hcaCliPath = hcaCliPath;
    }

    assertFiles(downloadJob: DownloadFilesJob): Promise<void> {
        return this._assertBundle(downloadJob.container, downloadJob.basePath);
        //ToDo: Check each file expected in downloadJob.files exists.
    }



    /**
     *
     * Downloads a bundle if it doesn't exist
     *
     * @param bundleUuid
     * @param bundleBaseDir
     */
    _assertBundle(bundleUuid: string, bundleBaseDir: string): Promise<void> {
        return BundleDownloader._checkBundleExists(bundleUuid, bundleBaseDir)
            .then((itExists) => {
                if (itExists) {
                    console.log(`Bundle with uuid ${bundleUuid} already exists at ${bundleBaseDir}`);
                    return Promise.resolve();
                } else {
                    console.log(`Downloading bundle with uuid ${bundleUuid}`);
                    const bundleDownloadRequest: BundleDownloadRequest = {
                        bundleUuid: bundleUuid,
                        cloudReplica: "aws",
                        bundleBaseDir: bundleBaseDir
                    };
                    return BundleDownloader._downloadBundle(this.hcaCliPath, bundleDownloadRequest).return();
                }
            });
    }

    static _downloadBundle(hcaCliPath: string, bundleDownloadRequest: BundleDownloadRequest) : Promise<void> {
        return new Promise<void>((resolve, reject) => {
            const runParams: BundleDownloadParams = BundleDownloader._bundleDownloadParamsFromBundleDownloadRequest(bundleDownloadRequest);
            const runArgs = BundleDownloader._bundleDownloadArgsFromParams(runParams);
            const bundleDownloadProcess = spawn(hcaCliPath, runArgs, {cwd: bundleDownloadRequest.bundleBaseDir});

            bundleDownloadProcess.on("exit", (code: number|null, signal: string|null) => {
                if(code != null && code == 0) {
                    resolve();
                } else {
                    if(code) {
                        reject(new Error("Failed to download bundle, process exited with code " + code));
                    } else if(signal) {
                        reject(new Error("Failed to download bundle, process exited with signal " + signal));
                    }
                }
            });

            bundleDownloadProcess.on("error", err => {
                reject(err);
            });

            bundleDownloadProcess.stderr.on("data" , (data: Buffer) => {
                console.log(data.toString());
            });
        });
    }

    static _checkBundleExists(bundleUuid: string, bundleBaseDir: string) : Promise<boolean> {
        return FileExistenceChecker.fileExists(`${bundleBaseDir}/${bundleUuid}`);
    }

    static _bundleDownloadParamsFromBundleDownloadRequest(downloadRequest: BundleDownloadRequest): BundleDownloadParams {
        return {
            bundleUuid: downloadRequest.bundleUuid,
            replica: downloadRequest.cloudReplica
        }
    }

    static _dssDownloadArgs(): string[] {
        return ["dss", "download"];
    }

    static _bundleDownloadArgsFromParams(downloadParams: BundleDownloadParams) : string[] {
        const bundleUuid = downloadParams.bundleUuid;
        const replica = downloadParams.replica;
        return BundleDownloader._dssDownloadArgs().concat(["--bundle-uuid", bundleUuid, "--replica", replica]);
    }
}

export default BundleDownloader;
