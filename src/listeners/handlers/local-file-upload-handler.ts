import Promise from "bluebird";
import {AmqpMessage, IHandler} from "./handler";
import FileUploader from "../../util/file-uploader";
import TusUpload from "../../model/tus-upload";
import url from "url";
import {
    ConvertFilesJob,
    DownloadBundleFilesJob,
    DownloadS3FilesJob,
    Job,
    UploadAssertion,
    UploadFilesJob
} from "../../common/types";
import Fastq2BamConverter from "../../util/fastq-2-bam-converter";
import R from "ramda";
import UploadPlanParser from "../../util/upload-plan-parser";
import S3Downloader from "../../util/s3-downloader";
import BundleDownloader from "../../util/bundle-downloader";

class LocalFileUploadHandler implements IHandler {
    fileUploader: FileUploader;
    fastq2BamConverter: Fastq2BamConverter;
    s3Downloader: S3Downloader;
    bundleDownloader: BundleDownloader;
    dirBasePath: string;

    constructor(fileUploader: FileUploader, fastq2BamConverter: Fastq2BamConverter, dirBasePath: string) {
        this.fileUploader = fileUploader;
        this.fastq2BamConverter = fastq2BamConverter;
        this.dirBasePath = dirBasePath;
        this.s3Downloader = S3Downloader.default();
        this.bundleDownloader = new BundleDownloader("hca");
    }

    handle(msg: AmqpMessage): Promise<void> {
        return LocalFileUploadHandler._parseAmqpMessage(msg).then(job => this.doLocalFileUpload(job));
    }

    doLocalFileUpload(job: Job): Promise<void> {
        return this._maybeDownloadFiles(job, this.dirBasePath)
            .then(() => LocalFileUploadHandler._maybeBamConvert(job, this.dirBasePath, this.fastq2BamConverter))
            .then(() => LocalFileUploadHandler._maybeUpload(job, this.fileUploader, this.dirBasePath))
            .return()
    }

    static _parseAmqpMessage(msg: AmqpMessage): Promise<Job> {
        try {
            return Promise.resolve(JSON.parse(msg.messageBytes) as Job);
        } catch (err) {
            console.error("Failed to parse message content (ignoring): " + msg.messageBytes);
            return Promise.reject(err);
        }
    }

    _maybeDownloadFiles(job: Job, fileDirBasePath :string): Promise<void> {
        if ( job.dcp_bundle_uuid ) {
            const bundleFilesJob: DownloadBundleFilesJob = UploadPlanParser.convertToDownloadBundleFilesJob(job, fileDirBasePath);
            return this.bundleDownloader.assertFiles(bundleFilesJob);
        } else {
            const s3FilesJob: DownloadS3FilesJob = UploadPlanParser.convertToDownloadFilesJob(job, fileDirBasePath);
            return this.s3Downloader.assertFiles(s3FilesJob);
        }
    }

    static _maybeBamConvert(job: Job, fileDirBasePath: string, fastq2BamConverter: Fastq2BamConverter): Promise<void> {
        if (!job.conversion) {
            return Promise.resolve();
        } else {
            const convertFilesJob = UploadPlanParser.convertToConvertFilesJob(job, fileDirBasePath);
            return LocalFileUploadHandler._doBamConversion(fastq2BamConverter, convertFilesJob);
        }
    }

    static _maybeUpload(job: Job, fileUploader: FileUploader, fileDirBasePath: string): Promise<UploadAssertion[]> {
        const uploadFilesJob: UploadFilesJob = UploadPlanParser.convertToUploadFilesJob(job);
        const tusUploads = LocalFileUploadHandler._uploadRequestsFromUploadMessage(uploadFilesJob, fileDirBasePath);
        const fn = (tusUpload: TusUpload) => fileUploader.assertFileUpload(tusUpload);
        const uploadPromises = R.map(fn, tusUploads);
        return Promise.all(uploadPromises);
    }

    static _doBamConversion(fastq2BamConverter: Fastq2BamConverter, convertFilesJob: ConvertFilesJob): Promise<void> {
        return fastq2BamConverter.assertBam(convertFilesJob)
            .then((exitCode: number) => {
                if (exitCode === 0) {
                    return Promise.resolve();
                } else {
                    const error = "ERROR: fastq2Bam converter returned non-successful error code: " + String(exitCode)
                    console.error(error);
                    return Promise.reject(error);
                }
            });
    }

    static _uploadRequestsFromUploadMessage(uploadFilesJob: UploadFilesJob, fileDirBasePath: string): TusUpload[] {
        const tusUploads: TusUpload[] = [];
        const uploadFileEndpoint = `${uploadFilesJob.dspUrl}/files/`;
        const usiUrl = uploadFilesJob.dspUrl;

        for (let i = 0; i < uploadFilesJob.files.length; i++) {
            const fileName = uploadFilesJob.files[i].fileName;
            const tusUpload = new TusUpload({
                fileName: fileName,
                filePath: `${fileDirBasePath}/${uploadFilesJob.manifestId}/${fileName}`
            }, uploadFileEndpoint);
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
