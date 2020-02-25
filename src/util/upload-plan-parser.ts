import {ConversionMap, UploadFilesJob, Job, UploadJobConversion} from "../common/types";
import R from "ramda";

class UploadPlanParser {

    static mapUploadFilesJob(uploadJob: Job): UploadFilesJob {
        return {
            manifestId: uploadJob.manifest_id,
            submissionUrl: uploadJob.submission_url,
            files: uploadJob.files,
            usiUrl: uploadJob.dsp_api_url,
            conversionMap: uploadJob.conversion ? UploadPlanParser.parseConversionMap(uploadJob.conversion) : undefined
        }
    }

    static parseConversionMap(uploadJobConversion: UploadJobConversion) : ConversionMap {
        return {
            inputs: R.map((conversionInput) => {return {readIndex: conversionInput.read_index, fileName: conversionInput.name} } , uploadJobConversion.inputs),
            outputName: uploadJobConversion.output_name
        }
    }
}

export default UploadPlanParser;
