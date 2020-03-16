import {
    ConvertFile,
    ConvertFilesJob,
    DownloadFile,
    DownloadFilesJob,
    File,
    Job,
    UploadFile,
    UploadFilesJob
} from "../common/types";
import R from "ramda";

class UploadPlanParser {

    static convertToUploadFilesJob(job: Job): UploadFilesJob {
        return {
            manifestId: job.manifest_id,
            submissionUrl: job.submission_url,
            files: UploadPlanParser.parseUploadFiles(job.files),
            dspUrl: job.dsp_api_url,
        }
    }

    static convertToDownloadFilesJob(job: Job, downloadDirBasePath: string): DownloadFilesJob {
        const filesToDownload: File[] = job.conversion ? job.conversion.inputs : job.files;

        const downloadJob: DownloadFilesJob = {
            basePath: downloadDirBasePath,
            container: job.manifest_id,
            files: UploadPlanParser.parseDownloadFiles(filesToDownload)
        };

        return downloadJob
    }

    static convertToConvertFilesJob(job: Job, fileDirBasePath: string): ConvertFilesJob {
        const convertFilesJob: ConvertFilesJob = {
            reads: UploadPlanParser.parseConvertFiles(job.conversion!.inputs),
            outputName: job.conversion!.output_name,
            outputDir: `${fileDirBasePath}/${job.manifest_id}`
        }
        return convertFilesJob;
    }

    static parseDownloadFiles(files: File[]): DownloadFile[] {
        return R.map((file) => {
            return {
                'fileName': file.name,
                'source': file.cloud_url
            }
        }, files);
    }

    static parseConvertFiles(files: File[]): ConvertFile[] {
        return R.map((conversionInput) => {
            return {
                readIndex: conversionInput.read_index,
                fileName: conversionInput.name,
            }
        }, files)
    }

    static parseUploadFiles(files: File[]): UploadFile[] {
        return R.map((file) => {
            return {fileName: file.name}
        }, files);
    }

}

export default UploadPlanParser;
