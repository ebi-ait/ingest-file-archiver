import S3Downloader from "./s3-downloader";
import * as AWSMock from "aws-sdk-mock";
import * as AWS from "aws-sdk";
import {GetObjectOutput, GetObjectRequest} from "aws-sdk/clients/S3";
import {PathLike, promises, promises as fsPromises} from "fs";
import {Readable} from "stream";

const writeMockFile = (mockFilePath: PathLike, mockFileContent: string) => {
    return fsPromises.writeFile(mockFilePath, mockFileContent);
};

describe("S3 downloader tests", () => {
    beforeAll(() => {
        AWSMock.setSDKInstance(AWS);
    });

    afterAll(() => {
        AWSMock.restore('S3');
    });

    it("should parse Buckets and Key from s3 URLs", () => {
        const mockS3Url = "s3://mock-bucket/mock-dir/mock-file.txt";
        const mockS3ObjectRequest = S3Downloader.s3ObjectRequest(mockS3Url);

        expect(mockS3ObjectRequest.Bucket).toBe("mock-bucket");
        expect(mockS3ObjectRequest.Key).toBe("mock-dir/mock-file.txt");
    });

    it("should check if a file exists", () => {
        const mockFileContent = "Hello World!";
        const mockFilePath = "mockfile.txt";

        writeMockFile(mockFilePath, mockFileContent)
            .then(() => S3Downloader.fileExists(mockFilePath))
            .then(exists => expect(exists).toBeTruthy())
            .then(() => {
                fsPromises.unlink(mockFilePath)
            });
    });

    it('should get read stream from S3', () => {
        const s3Downloader: S3Downloader = new S3Downloader();
        const mockS3Url = "s3://mock-bucket/mock-dir/mock-file.txt";
        const mockStream: Readable = new Readable();
        const mockObjectContent: GetObjectOutput = {
            Body: mockStream
        };

        AWSMock.mock('S3', 'getObject', (params: GetObjectRequest, callback: Function) => {
            console.log('S3', 'getObject', 'mock called');
            callback(null, mockObjectContent);
        });

        s3Downloader.getS3Stream(mockS3Url)
            .then(stream => {
                return new Promise<string>(((resolve, reject) => {
                    let streamResults: string = "";
                    stream.on("data", (chunk) => {
                        streamResults += chunk;
                    });
                    stream.on("end", () => {
                        resolve(streamResults);
                    });
                    stream.on("error", (error) => reject(error));
                }));
            })
    });
});
