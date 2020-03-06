import {Job} from "../common/types";
import UploadPlanParser from "./upload-plan-parser";

describe("Upload plan parser tests", () => {
   it("should handle null/undefined conversion maps in the upload plan", () => {
       const mockUploadJob: Job = {
           dsp_api_url: "http://mock-dsp-api-url",
           ingest_api_url: "http://mock-ingest-api-url",
           submission_url: "http://mock-usi-api-url/mock-submission-id",
           files: [{
               fileName: 'mockFastq1.fast.gz',
               readIndex: "read1",
               cloudUrl: "cloud1"
           }],
           manifest_id: "mock-manifest-id",
           conversion: undefined
       };

       expect(UploadPlanParser.mapUploadFilesJob(mockUploadJob)).toBeTruthy();
   })
});
