import LocalFileUploadHandler from "./local-file-upload-handler";
import * as url from "url";
import {ConversionMap, FastqReadInfo, UploadFile, UploadFilesJob} from "../../common/types";
import TusUpload from "../../model/tus-upload";


describe("Local file uploader tests", () => {
    it("should parse submission uuids from submission URIs", () => {
        const mockSubmissionUuid = "deadbeef-dead-dead-dead-deaddeafbeef";
        const mockSubmissionUrl = new url.URL(`https://mock-usi/api/submissions/${mockSubmissionUuid}`);

        expect(LocalFileUploadHandler._submissionUuidFromSubmissionUri(mockSubmissionUrl)).toEqual(mockSubmissionUuid);
    });

    it("should generate upload requests file upload messages", () => {
        const mockFiles : FastqReadInfo[] = [
            {
                fileName: 'mockFileName1',
                readIndex: "read1",
                cloudUrl: "cloud1"
            },
            {
                fileName: 'mockFileName2',
                readIndex: "read2",
                cloudUrl: "cloud2"
            },
            {
                fileName: 'mockFileName3',
                readIndex: "read3",
                cloudUrl: "cloud3"
            }
        ];
        const mockSubmissionUuid = "deadbeef-dead-dead-dead-deaddeafbeef";
        const mockDspUrl = "https://mock-dsp";
        const mockSubmissionUrl = new url.URL(`${mockDspUrl}/api/submissions/${mockSubmissionUuid}`);
        const mockManifestId = "mock-manifest-id";
        const mockFileBasePathDir = "/data/myfiles";

        const mockUploadMessage : UploadFilesJob = {
            files: mockFiles,
            dspUrl: mockDspUrl,
            submissionUrl: mockSubmissionUrl.toString(),
            manifestId: mockManifestId
        };

        const uploadRequests: TusUpload[] = LocalFileUploadHandler._uploadRequestsFromUploadMessage(mockUploadMessage, mockFileBasePathDir);

        expect(uploadRequests.length).toBe(3);

        uploadRequests.forEach((tusUpload: TusUpload) => {
            expect(tusUpload.fileInfo.filePath).toMatch((new RegExp(`${mockFileBasePathDir}/${mockManifestId}/mockFileName[123]`)));
            expect(tusUpload.submission).toEqual(mockSubmissionUuid);
            expect(tusUpload.uploadUrl).toEqual(`${mockDspUrl}/files/`);
            expect(tusUpload.fileInfo.fileName).toMatch(new RegExp("mockFileName[123]"));
        });
    });

    it("should generate bam conversion requests", () => {
        const mockR1 = "mockR1.fastq.gz";
        const mockR2 = "mockR2.fastq.gz";
        const mockIndex = "mockI.fastq.gz";

        const mockOutputName = "mockbam.bam";
        const mockManifestId = "mock-manifest-id";
        const mockFileBasePathDir = `/data/myfiles/${mockManifestId}`;

        const mockConversionMapPair: ConversionMap = {
            inputs: [
                {
                    readIndex: "read1",
                    fileName: mockR1,
                    cloudUrl:'cloudUrl1'
                },
                {
                    readIndex: "read2",
                    fileName: mockR2,
                    cloudUrl:'cloudUrl1'

                },
                {
                    readIndex: "index1",
                    fileName: mockIndex,
                    cloudUrl:'cloudUrl1'
                }
            ],
            outputName: mockOutputName
        };

        const convertRequestPair = LocalFileUploadHandler._generateBamConvertRequest(mockConversionMapPair, mockFileBasePathDir);
        expect(convertRequestPair.reads).toContainEqual({readIndex: "read1", fileName: mockR1});
        expect(convertRequestPair.reads).toContainEqual({readIndex: "read2", fileName: mockR2});
        expect(convertRequestPair.reads).toContainEqual({readIndex: "index1", fileName: mockIndex});
        expect(convertRequestPair.outputName).toEqual(mockOutputName);
        expect(convertRequestPair.outputName).toEqual(mockOutputName);
        expect(convertRequestPair.outputDir).toEqual(mockFileBasePathDir);
    });
});
