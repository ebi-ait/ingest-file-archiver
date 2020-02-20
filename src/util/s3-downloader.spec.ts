import S3Downloader from "./s3-downloader";
import {Request, Response, AWSError, S3} from "aws-sdk";
import {GetObjectOutput} from "aws-sdk/clients/S3";
import {PathLike, promises as fsPromises} from "fs";
import {Readable} from "stream";
import * as TypeMoq from "typemoq";
import {PromiseResult} from "aws-sdk/lib/request";
import * as fs from "fs";
import {Times} from "typemoq";

const writeMockFile = (mockFilePath: PathLike, mockFileContent: string) => {
    return fsPromises.writeFile(mockFilePath, mockFileContent);
};

function stringifyStream(stream: Readable) {
    return new Promise<string>(((resolve, reject) => {
        let stringResults: string = "";
        stream.on("data", (chunk) => stringResults += chunk);
        stream.on("end", () => resolve(stringResults));
        stream.on("error", (error) => reject(error));
    }));
}

describe("S3 downloader tests", () => {
    beforeAll(() => {
        if( !fs.existsSync("mocks"))
            fs.mkdirSync("mocks");
    });

    it("should parse Buckets and Key from s3 URLs", done => {
        const mockS3Url = "s3://mock-bucket/mock-dir/mock-file.txt";
        const mockS3ObjectRequest = S3Downloader.s3ObjectRequest(mockS3Url);

        expect(mockS3ObjectRequest.Bucket).toBe("mock-bucket");
        expect(mockS3ObjectRequest.Key).toBe("mock-dir/mock-file.txt");
        done();
    });

    it("should check if a file exists", done => {
        const mockFileContent = "Hello File!";
        const mockFilePath = "mocks/file-exists.txt";

        writeMockFile(mockFilePath, mockFileContent)
            .then(() => S3Downloader.fileExists(mockFilePath))
            .then(exists => expect(exists).toBeTruthy())
            .then(() => fsPromises.unlink(mockFilePath))
            .then(done());
    });

    function SetupS3Mock(content: string) {
        const exampleText = content;
        const mockStream: Readable = new Readable();
        mockStream._read = () => {
        };

        const mockPromise: PromiseResult<GetObjectOutput, AWSError> = {
            Body: exampleText,
            $response: TypeMoq.Mock.ofType<Response<GetObjectOutput, AWSError>>().object
        };

        const mockS3ClientFactory = TypeMoq.Mock.ofType<S3>();
        const mockResponseFactory = TypeMoq.Mock.ofType<Request<S3.Types.GetObjectOutput, AWSError>>();

        mockResponseFactory.setup(m => m.promise()).returns(() => Promise.resolve(mockPromise));
        mockResponseFactory.setup(m => m.createReadStream()).returns(() => mockStream);
        mockS3ClientFactory.setup(client => client.getObject(TypeMoq.It.isAny())).returns(() => mockResponseFactory.object);

        mockStream.push(exampleText);
        mockStream.push(null);
        return {exampleText, mockS3ClientFactory};
    }

    it('should get read stream from S3', done => {
        //Arrange
        const mockS3Url = "s3://mock-bucket/read-stream/mock-file.txt";
        const {exampleText, mockS3ClientFactory} = SetupS3Mock("Hello S3 Stream!");
        const s3Downloader: S3Downloader = new S3Downloader(mockS3ClientFactory.object);

        //Act
        s3Downloader.getS3Stream(mockS3Url)
            .then(stream => stringifyStream(stream))
            .then(text => {
                expect(text).toBe(exampleText);
                done();
            });
    });

    it("should ensure to download a file from S3 if the file doesn't exist in local storage", done => {
        const mockS3Url = "s3://mock-bucket/assert-file/mock-file.txt";
        const {exampleText, mockS3ClientFactory} = SetupS3Mock("Hello S3 File!");

        const s3Downloader: S3Downloader = new S3Downloader(mockS3ClientFactory.object);

        s3Downloader.assertFile("mocks", {fileName: "assert-file.txt", source: mockS3Url})
            .then((filePath) => {
                fsPromises.readFile(filePath).then((data) => {
                    mockS3ClientFactory.verify(mockObj => mockObj.getObject(TypeMoq.It.isAny()), Times.atLeastOnce());
                    expect(data).toEqual(Buffer.from(exampleText));
                    fsPromises.unlink(filePath).then(() => done());
                });
            });
    });
});
