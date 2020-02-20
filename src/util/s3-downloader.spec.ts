import S3Downloader from "./s3-downloader";
import AWS, {AWSError, S3} from "aws-sdk";
import {GetObjectOutput, GetObjectRequest} from "aws-sdk/clients/S3";
import {PathLike, promises, promises as fsPromises} from "fs";
import {Readable} from "stream";
import * as TypeMoq from "typemoq";

const writeMockFile = (mockFilePath: PathLike, mockFileContent: string) => {
    return fsPromises.writeFile(mockFilePath, mockFileContent);
};

describe("S3 downloader tests", () => {

    it("should parse Buckets and Key from s3 URLs", done => {
        const mockS3Url = "s3://mock-bucket/mock-dir/mock-file.txt";
        const mockS3ObjectRequest = S3Downloader.s3ObjectRequest(mockS3Url);

        expect(mockS3ObjectRequest.Bucket).toBe("mock-bucket");
        expect(mockS3ObjectRequest.Key).toBe("mock-dir/mock-file.txt");
        done();
    });

    it("should check if a file exists", done => {
        const mockFileContent = "Hello World!";
        const mockFilePath = "mockfile.txt";

        writeMockFile(mockFilePath, mockFileContent)
            .then(() => S3Downloader.fileExists(mockFilePath))
            .then(exists => {
                expect(exists).toBeTruthy();
                fsPromises.unlink(mockFilePath);
                done();
            });
    });

    it('should get read stream from S3',  done => {
        const mockS3Url = "s3://mock-bucket/mock-dir/mock-file.txt";
        const mockStream: Readable = new Readable();
        mockStream._read = () => {};

        const mockObjectContent: GetObjectOutput = {
            Body: mockStream
        };

        const mockS3Client: TypeMoq.IMock<S3> = TypeMoq.Mock.ofType<S3>();

        mockS3Client
            .setup(mockInstance => mockInstance.getObject(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
            .callback((params, callback:any) => callback(null, mockObjectContent))
            .returns(() => {
                return TypeMoq.Mock.ofType<AWS.Request<GetObjectOutput, AWSError>>().object;
            });

        const s3Downloader: S3Downloader = new S3Downloader(mockS3Client.object);


        mockStream.push("Hello World!");
        mockStream.push(null);

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
            }).then(streamResults => {
                expect(streamResults).toBe("Hello World!");
                done();
            });
    });
});
