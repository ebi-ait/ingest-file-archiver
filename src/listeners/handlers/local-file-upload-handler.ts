import Promise from "bluebird";
import {IHandler, AmqpMessage} from "./handler";
import FileUploader from "../../util/file-uploader";
import TusUpload from "../../model/tus-upload";
import url from "url";
import {ConversionMap, Fastq2BamConvertRequest, FileUploadMessage, UploadAssertion} from "../../common/types";
import Fastq2BamConverter from "../../util/fastq-2-bam-converter";
import R from "ramda";
import FileDownloader from "../../util/file-downloader";

class LocalFileUploadHandler implements IHandler {
    fileUploader: FileUploader;
    fastq2BamConverter: Fastq2BamConverter;
    fileDownloader: FileDownloader;
    dirBasePath: string;

    constructor(fileUploader: FileUploader, fastq2BamConverter: Fastq2BamConverter, fileDownloader: FileDownloader, dirBasePath: string) {
        this.fileUploader = fileUploader;
        this.fastq2BamConverter = fastq2BamConverter;
        this.fileDownloader = fileDownloader;
        this.dirBasePath = dirBasePath;
    }

    handle(msg: AmqpMessage) : Promise<void> {
            return new Promise<void>((resolve, reject) => {
                LocalFileUploadHandler._parseAmqpMessage(msg)
                    .then((msgContent) => {return this.doLocalFileUpload(msgContent)});
            });
    }

    doLocalFileUpload(fileUploadMessage: FileUploadMessage): Promise<void>{
        return LocalFileUploadHandler._maybeDownloadFile(fileUploadMessage, this.dirBasePath, this.fileDownloader)
            .then(() => { return LocalFileUploadHandler._maybeBamConvert(fileUploadMessage, this.dirBasePath, this.fastq2BamConverter)})
            .then(() => { return LocalFileUploadHandler._maybeUpload(fileUploadMessage, this.fileUploader, this.dirBasePath)})
            .then(() => { return Promise.resolve()});
    }

    static _parseAmqpMessage(msg: AmqpMessage) : Promise<FileUploadMessage> {
        try {
            return Promise.resolve(JSON.parse(msg.messageBytes) as FileUploadMessage);
        } catch (err) {
            console.error("Failed to parse message content (ignoring): " + msg.messageBytes);
            return Promise.reject(err);
        }
    }

    static _maybeDownloadFile(fileUploadMessage: FileUploadMessage, fileDirBasePath: string, fileDownloader: FileDownloader): Promise<void> {
        return fileDownloader.assertFile(fileUploadMessage.manifestId, fileDirBasePath);
    }

    static _maybeBamConvert(fileUploadMessage: FileUploadMessage, fileDirBasePath: string, fastq2BamConverter: Fastq2BamConverter) : Promise<void> {
        if(! fileUploadMessage.conversionMap) {
            return Promise.resolve();
        } else {
            const bamConvertRequest = LocalFileUploadHandler._generateBamConvertRequest(fileUploadMessage.conversionMap!, `${fileDirBasePath}/${fileUploadMessage.manifestId}`);
            return LocalFileUploadHandler._doBamConversion(fastq2BamConverter, bamConvertRequest);
        }
    }

    static _doBamConversion(fastq2BamConverter: Fastq2BamConverter, bamConvertRequest: Fastq2BamConvertRequest) : Promise<void> {
        return new Promise<void>((resolve, reject) => {
            fastq2BamConverter.assertBam(bamConvertRequest)
                .then((exitCode: number) => {
                    if(exitCode === 0) {
                        resolve();
                    } else {
                        console.error("ERROR: fastq2Bam converter returned non-successful error code: " + String(exitCode));
                        reject();
                    }
                })
        });
    }

    static _generateBamConvertRequest(uploadMessageConversionMap: ConversionMap, fileDirBasePath: string) : Fastq2BamConvertRequest {
        return {
            reads: uploadMessageConversionMap.inputs,
            outputName:  uploadMessageConversionMap.outputName,
            outputDir: fileDirBasePath
        }
    }

    static _maybeUpload(fileUploadMessage: FileUploadMessage, fileUploader: FileUploader, fileDirBasePath: string): Promise<UploadAssertion[]> {
        const tusUploads = LocalFileUploadHandler._uploadRequestsFromUploadMessage(fileUploadMessage, fileDirBasePath);
        const fn = (tusUpload: TusUpload) => fileUploader.assertFileUpload(tusUpload);
        const uploadPromises = R.map(fn, tusUploads);
        return Promise.all(uploadPromises);
    }

    static _uploadRequestsFromUploadMessage(uploadMessage: FileUploadMessage, fileDirBasePath: string) : TusUpload[] {
        const tusUploads: TusUpload[] = [];
        const uploadFileEndpoint = `${uploadMessage.usiUrl}/files/`;
        const usiUrl = uploadMessage.usiUrl;

        for(let i = 0; i < uploadMessage.fileNames.length; i ++) {
            const fileName = uploadMessage.fileNames[i];
            const tusUpload = new TusUpload({fileName: fileName, filePath: `${fileDirBasePath}/${uploadMessage.manifestId}/${fileName}`}, uploadFileEndpoint);
            tusUpload.submission = LocalFileUploadHandler._submissionUuidFromSubmissionUri(new url.URL(uploadMessage.submissionUrl));
            tusUpload.usiUrl = usiUrl;
            tusUploads.push(tusUpload);
        }

        return tusUploads;
    }

    static _submissionUuidFromSubmissionUri(submissionUri: url.URL): string {
        const splitPath: string[] = submissionUri.pathname.split("/");
        return splitPath[splitPath.length - 1];
    }
}

export default LocalFileUploadHandler;