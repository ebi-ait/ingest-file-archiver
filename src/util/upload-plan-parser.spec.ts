import {Job} from "../common/types";
import UploadPlanParser from "./upload-plan-parser";

describe("Upload plan parser tests", () => {
   it("should handle null/undefined conversion maps in the upload plan", () => {
       const mockUploadJob: Job = {
           dsp_api_url: "http://mock-dsp-api-url",
           submission_url: "http://mock-usi-api-url/mock-submission-id",
           files: [{
               name: 'mockFastq1.fast.gz',
               read_index: "read1",
               cloud_url: "cloud1"
           }],
           manifest_id: "mock-manifest-id",
           conversion: undefined
       };

       expect(UploadPlanParser.convertToUploadFilesJob(mockUploadJob)).toBeTruthy();
   })
});
