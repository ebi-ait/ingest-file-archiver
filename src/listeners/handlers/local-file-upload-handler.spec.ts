import LocalFileUploadHandler from "./local-file-upload-handler";
import * as url from "url";
import {Conversion, File, Job, UploadFile, UploadFilesJob} from "../../common/types";
import TusUpload from "../../model/tus-upload";
import UploadPlanParser from "../../util/upload-plan-parser";


describe("Local file uploader tests", () => {
    it("should parse submission uuids from submission URIs", () => {
        const mockSubmissionUuid = "deadbeef-dead-dead-dead-deaddeafbeef";
        const mockSubmissionUrl = new url.URL(`https://mock-usi/api/submissions/${mockSubmissionUuid}`);

        expect(LocalFileUploadHandler._submissionUuidFromSubmissionUri(mockSubmissionUrl)).toEqual(mockSubmissionUuid);
    });

    it("should generate upload requests file upload messages", () => {
        const mockFiles: UploadFile[] = [
            {
                fileName: 'mockFileName1'
            },
            {
                fileName: 'mockFileName2'
            },
            {
                fileName: 'mockFileName3'
            }
        ];
        const mockSubmissionUuid = "deadbeef-dead-dead-dead-deaddeafbeef";
        const mockDspUrl = "https://mock-dsp";
        const mockSubmissionUrl = new url.URL(`${mockDspUrl}/api/submissions/${mockSubmissionUuid}`);
        const mockManifestId = "mock-manifest-id";
        const mockFileBasePathDir = "/data/myfiles";

        const mockUploadMessage: UploadFilesJob = {
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

        const conversion: Conversion = {
            inputs: [
                {
                    read_index: "read1",
                    name: mockR1,
                    cloud_url: 'cloudUrl1'
                },
                {
                    read_index: "read2",
                    name: mockR2,
                    cloud_url: 'cloudUrl1'

                },
                {
                    read_index: "index1",
                    name: mockIndex,
                    cloud_url: 'cloudUrl1'
                }
            ],
            output_name: mockOutputName
        };

        const files: File[] = [];
        const job: Job = {
            dsp_api_url: '',
            ingest_api_url: '',
            submission_url: '',
            files: files,
            manifest_id: '',
            conversion: conversion
        };

        const convertRequestPair = UploadPlanParser.convertToConvertFilesJob(job, mockFileBasePathDir);
        expect(convertRequestPair.reads).toContainEqual({readIndex: "read1", fileName: mockR1});
        expect(convertRequestPair.reads).toContainEqual({readIndex: "read2", fileName: mockR2});
        expect(convertRequestPair.reads).toContainEqual({readIndex: "index1", fileName: mockIndex});
        expect(convertRequestPair.outputName).toEqual(mockOutputName);
        expect(convertRequestPair.outputName).toEqual(mockOutputName);
        expect(convertRequestPair.outputDir).toEqual(mockFileBasePathDir);
    });
});
