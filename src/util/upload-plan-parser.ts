import {
    ConvertFile,
    ConvertFilesJob,
    DownloadFile,
    DownloadBundleFilesJob,
    DownloadS3FilesJob,
    File,
    Job,
    FileName,
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

    static convertToDownloadFilesJob(job: Job, downloadDirBasePath: string): DownloadS3FilesJob {
        const filesToDownload: File[] = job.conversion ? job.conversion.inputs : job.files;

        return {
            basePath: downloadDirBasePath,
            container: job.manifest_id,
            files: UploadPlanParser.parseDownloadFiles(filesToDownload)
        }
    }

    static convertToDownloadBundleFilesJob(job: Job, basePath: string): DownloadBundleFilesJob {
        const filesToDownload: File[] = job.conversion ? job.conversion.inputs : job.files;
        if (job.dcp_bundle_uuid) {
            return {
                basePath: basePath,
                bundleUuid: job.dcp_bundle_uuid,
                container: job.manifest_id,
                files: R.map((file :File) => { return { fileName: file.name } }, filesToDownload)
            };
        } else {
            throw new TypeError("Cannot create DCP Download Job without DCP Bundle UUID")
        }
    }

    static convertToConvertFilesJob(job: Job, fileDirBasePath: string): ConvertFilesJob {
        return {
            reads: UploadPlanParser.parseConvertFiles(job.conversion!.inputs),
            outputName: job.conversion!.output_name,
            outputDir: `${fileDirBasePath}/${job.manifest_id}`
        };
    }

    static parseDownloadFiles(files: File[]): DownloadFile[] {
        return R.map((file) => {
            let source = "";
            if (file.cloud_url) {
                source = file.cloud_url;
            }
            return {
                'fileName': file.name,
                'source':  source
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

    static parseUploadFiles(files: File[]): FileName[] {
        return R.map((file) => {
            return {fileName: file.name}
        }, files);
    }
}

export default UploadPlanParser;
