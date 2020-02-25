import Promise from "bluebird";
import {AmqpMessage, IHandler} from "./handler";
import FileUploader from "../../util/file-uploader";
import TusUpload from "../../model/tus-upload";
import url from "url";
import {
    ConversionMap,
    DownloadFilesJob,
    Fastq2BamConvertRequest,
    UploadFilesJob,
    UploadAssertion,
    UploadFile,
    DownloadFile
} from "../../common/types";
import Fastq2BamConverter from "../../util/fastq-2-bam-converter";
import R from "ramda";
import IFileDownloader from "../../util/file-downloader";

class LocalFileUploadHandler implements IHandler {
    fileUploader: FileUploader;
    fastq2BamConverter: Fastq2BamConverter;
    fileDownloader: IFileDownloader;
    dirBasePath: string;

    constructor(fileUploader: FileUploader, fastq2BamConverter: Fastq2BamConverter, fileDownloader: IFileDownloader, dirBasePath: string) {
        this.fileUploader = fileUploader;
        this.fastq2BamConverter = fastq2BamConverter;
        this.fileDownloader = fileDownloader;
        this.dirBasePath = dirBasePath;
    }

    handle(msg: AmqpMessage) : Promise<void> {
            return LocalFileUploadHandler._parseAmqpMessage(msg).then(msgContent =>  this.doLocalFileUpload(msgContent));
    }

    doLocalFileUpload(job: UploadFilesJob): Promise<void>{
        const downloadJob: DownloadFilesJob = {
            'basePath': this.dirBasePath,
            'container': job.manifestId,
            'files': LocalFileUploadHandler._convertUploadFiles(job.files)
        };

        return LocalFileUploadHandler._maybeDownloadFiles(downloadJob, this.fileDownloader)
            .then(() => LocalFileUploadHandler._maybeBamConvert(job, this.dirBasePath, this.fastq2BamConverter))
            .then(() => LocalFileUploadHandler._maybeUpload(job, this.fileUploader, this.dirBasePath))
            .return()
    }

    static _convertUploadFiles(uploadFiles: UploadFile[] ): DownloadFile[] {
        let downloadFiles: DownloadFile[] = [];
        for (let uploadFile of uploadFiles) {
            let downloadFile : DownloadFile = {
                'fileName': uploadFile.name,
                'source': uploadFile.cloud_url,
            };
            downloadFiles.push(downloadFile);
        }
        return downloadFiles;
    }

    static _parseAmqpMessage(msg: AmqpMessage) : Promise<UploadFilesJob> {
        try {
            return Promise.resolve(JSON.parse(msg.messageBytes) as UploadFilesJob);
        } catch (err) {
            console.error("Failed to parse message content (ignoring): " + msg.messageBytes);
            return Promise.reject(err);
        }
    }

    static _maybeDownloadFiles(downloadJob: DownloadFilesJob, fileDownloader: IFileDownloader): Promise<void> {
        return fileDownloader.assertFiles(downloadJob);
    }

    static _maybeBamConvert(uploadFilesJob: UploadFilesJob, fileDirBasePath: string, fastq2BamConverter: Fastq2BamConverter) : Promise<void> {
        if(! uploadFilesJob.conversionMap) {
            return Promise.resolve();
        } else {
            const bamConvertRequest = LocalFileUploadHandler._generateBamConvertRequest(uploadFilesJob.conversionMap!, `${fileDirBasePath}/${uploadFilesJob.manifestId}`);
            return LocalFileUploadHandler._doBamConversion(fastq2BamConverter, bamConvertRequest);
        }
    }

    static _doBamConversion(fastq2BamConverter: Fastq2BamConverter, bamConvertRequest: Fastq2BamConvertRequest) : Promise<void> {
        return fastq2BamConverter.assertBam(bamConvertRequest)
            .then((exitCode: number) => {
                if(exitCode === 0) {
                    return Promise.resolve();
                } else {
                    const error = "ERROR: fastq2Bam converter returned non-successful error code: " + String(exitCode)
                    console.error(error);
                    return Promise.reject(error);
                }
            });
    }

    static _generateBamConvertRequest(uploadMessageConversionMap: ConversionMap, fileDirBasePath: string) : Fastq2BamConvertRequest {
        return {
            reads: uploadMessageConversionMap.inputs,
            outputName:  uploadMessageConversionMap.outputName,
            outputDir: fileDirBasePath
        }
    }

    static _maybeUpload(uploadFilesJob: UploadFilesJob, fileUploader: FileUploader, fileDirBasePath: string): Promise<UploadAssertion[]> {
        const tusUploads = LocalFileUploadHandler._uploadRequestsFromUploadMessage(uploadFilesJob, fileDirBasePath);
        const fn = (tusUpload: TusUpload) => fileUploader.assertFileUpload(tusUpload);
        const uploadPromises = R.map(fn, tusUploads);
        return Promise.all(uploadPromises);
    }

    static _uploadRequestsFromUploadMessage(uploadFilesJob: UploadFilesJob, fileDirBasePath: string) : TusUpload[] {
        const tusUploads: TusUpload[] = [];
        const uploadFileEndpoint = `${uploadFilesJob.dspUrl}/files/`;
        const usiUrl = uploadFilesJob.dspUrl;

        for(let i = 0; i < uploadFilesJob.files.length; i ++) {
            const fileName = uploadFilesJob.files[i].name;
            const tusUpload = new TusUpload({fileName: fileName, filePath: `${fileDirBasePath}/${uploadFilesJob.manifestId}/${fileName}`}, uploadFileEndpoint);
            tusUpload.submission = LocalFileUploadHandler._submissionUuidFromSubmissionUri(new url.URL(uploadFilesJob.submissionUrl));
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
