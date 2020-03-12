import {Conversion, ConversionMap, UploadFile, File, Job, UploadFilesJob} from "../common/types";
import R from "ramda";

class UploadPlanParser {

    static mapUploadFilesJob(uploadJob: Job): UploadFilesJob {
        return {
            manifestId: uploadJob.manifest_id,
            submissionUrl: uploadJob.submission_url,
            files: UploadPlanParser.parseFiles(uploadJob.files),
            dspUrl: uploadJob.dsp_api_url,
            conversionMap: uploadJob.conversion ? UploadPlanParser.parseConversionMap(uploadJob.conversion) : undefined
        }
    }

    static parseConversionMap(conversion: Conversion): ConversionMap {
        return {
            inputs: R.map((conversionInput) => {
                return {
                    readIndex: conversionInput.read_index,
                    fileName: conversionInput.name,
                    cloudUrl: conversionInput.cloud_url
                }
            }, conversion.inputs),
            outputName: conversion.output_name
        }
    }

    static parseFiles(files: File[]): UploadFile[] {
        return R.map((file) => {
            return {readIndex: file.read_index, fileName: file.name, cloudUrl: file.cloud_url}
        }, files);
    }

}

export default UploadPlanParser;
