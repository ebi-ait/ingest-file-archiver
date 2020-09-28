import tus, {Upload} from "tus-js-client";
import TokenManager from "./token-manager";
import TusUpload from "../model/tus-upload";
import Promise from "bluebird";
import fs from "fs";
import {UploadAssertion} from "../common/types";
import UsiClient from "./usi-client";


/**
 *
 * Stages a File for archiving in the EBI using a tus.io client
 *
 */
class FileUploader {
    tokenManager: TokenManager;

    constructor(tokenManager: TokenManager) {
        this.tokenManager = tokenManager;
    }

    /**
     *
     * Given a TusUpload object, uploads the specified file
     */
    stageLocalFile(tusUpload: TusUpload): Promise<Upload> {
        tusUpload.fileInfo.fileSize = fs.statSync(tusUpload.fileInfo.filePath!).size;
        tusUpload.fileInfo.fileStream = fs.createReadStream(tusUpload.fileInfo.filePath!);

        return this.doUpload(tusUpload);
    }

    assertFileUpload(tusUpload: TusUpload): Promise<UploadAssertion> {
        const submissionId = tusUpload.submission!;
        const fileName = tusUpload.fileInfo.fileName;
        const usiClient = new UsiClient(tusUpload.usiUrl!, this.tokenManager);
        return usiClient.checkFileAlreadyUploaded(submissionId, fileName)
            .then(isUploaded => {
                if (isUploaded) {
                    const alreadyUploaded: UploadAssertion = "ALREADY_UPLOADED";
                    console.log(`File with name ${fileName} has already been uploaded for submission ${submissionId}`);
                    return Promise.resolve(alreadyUploaded);
                } else {
                    return this.stageLocalFile(tusUpload).then((upload: UploadAssertion) => Promise.resolve(upload));
                }
            });
    }

    /**
     * Performs the upload, resolves when the upload finishes successfully
     *
     * @param tusUpload
     * @private
     */
    doUpload(tusUpload: TusUpload): Promise<tus.Upload> {
        return this._getToken()
            .then(token => {
                return FileUploader._insertToken(tusUpload, token)
            })
            .then(tusUpload => {
                return FileUploader._insertSubmission(tusUpload, tusUpload.submission!)
            })
            .then(tusUpload => {
                return FileUploader._insertFileName(tusUpload, tusUpload.fileInfo.fileName!)
            })
            .then(tusUpload => {
                return this._doUpload(tusUpload)
            });
    }

    _doUpload(tusUpload: TusUpload): Promise<tus.Upload> {
        return new Promise<Upload>((resolve, reject) => {
            // TODO: maintainers of tus-js-client need to add streams as an allowable type for tus file sources
            // @ts-ignore TODO: tus.io typescript maintainers need to allow Readable streams here
            const fileStream: Blob = tusUpload.fileInfo.fileStream!;

            let upload: Upload;

            const params = {
                endpoint: tusUpload.uploadUrl!,
                uploadUrl: tusUpload.uploadUrl!,
                retryDelays: [0, 1000, 3000, 5000],
                metadata: tusUpload.metadataToDict(),
                chunkSize: 2000000,
                uploadSize: tusUpload.fileInfo.fileSize
            };

            console.log('tus upload', params);

            upload = new tus.Upload(fileStream, {
                endpoint: tusUpload.uploadUrl!,
                uploadUrl: tusUpload.uploadUrl!,
                retryDelays: [0, 1000, 3000, 5000],
                // @ts-ignore: TODO: tus-js-client typescript not being maintained
                metadata: tusUpload.metadataToDict(),
                chunkSize: 2000000,
                uploadSize: tusUpload.fileInfo.fileSize,
                onError: (error: any) => {
                    console.log("Failed because: " + error);
                    reject(error);
                },
                onProgress: (bytesUploaded: number, bytesTotal: number) => {
                    const percentage = (bytesUploaded / bytesTotal * 100).toFixed(2);
                    console.log(bytesUploaded, bytesTotal, percentage + "%");
                },
                onSuccess: () => {
                    console.log("Upload complete");
                    resolve(upload);
                }
            });

            upload.start();
        });
    }

    static _insertToken(tusUpload: TusUpload, token: string): Promise<TusUpload> {
        return Promise.resolve(tusUpload.addToken(token));
    }

    static _insertSubmission(tusUpload: TusUpload, submission: string): Promise<TusUpload> {
        return Promise.resolve(tusUpload.addSubmission(submission));
    }

    static _insertFileName(tusUpload: TusUpload, fileName: string): Promise<TusUpload> {
        return Promise.resolve(tusUpload.addFileName(fileName));
    }

    _getToken(): Promise<string> {
        return this.tokenManager.getToken();
    }
}

export default FileUploader;
