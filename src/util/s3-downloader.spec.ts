import S3Downloader from "./s3-downloader";
import {Request, Response, AWSError, S3} from "aws-sdk";
import {GetObjectOutput} from "aws-sdk/clients/S3";
import {promises as fsPromises} from "fs";
import {Readable} from "stream";
import * as TypeMoq from "typemoq";
import {PromiseResult} from "aws-sdk/lib/request";
import * as fs from "fs";
import {Times} from "typemoq";

function stringifyStream(stream: Readable) {
    return new Promise<string>(((resolve, reject) => {
        let stringResults: string = "";
        stream.on("data", (chunk) => stringResults += chunk);
        stream.on("end", () => resolve(stringResults));
        stream.on("error", (error) => reject(error));
    }));
}

function expectBufferToMatchString(actual: Buffer, expected: string,) {
    const actualString = actual.toString();
    expect(actualString).toMatch(expected);
}

function deleteFolderRecursive(path: string) {
    let files = [];
    if( fs.existsSync(path) ) {
        files = fs.readdirSync(path);
        files.forEach(function(file){
            const curPath = path + "/" + file;
            if(fs.lstatSync(curPath).isDirectory()) { // recurse
                deleteFolderRecursive(curPath);
            } else { // delete file
                fs.unlinkSync(curPath);
            }
        });
        fs.rmdirSync(path);
    }
}

describe("S3 downloader tests", () => {
    beforeAll(() => {
        if( !fs.existsSync("mocks"))
            fs.mkdirSync("mocks");
    });

    afterAll(() => {
        deleteFolderRecursive("mocks");
    });

    function SetupS3Mock(content: string) {
        const s3Text = content;
        const mockStream: Readable = new Readable();
        mockStream._read = () => {
        };

        const mockPromise: PromiseResult<GetObjectOutput, AWSError> = {
            Body: s3Text,
            $response: TypeMoq.Mock.ofType<Response<GetObjectOutput, AWSError>>().object
        };

        const mockS3ClientFactory = TypeMoq.Mock.ofType<S3>();
        const mockResponseFactory = TypeMoq.Mock.ofType<Request<S3.Types.GetObjectOutput, AWSError>>();

        mockResponseFactory.setup(m => m.promise()).returns(() => Promise.resolve(mockPromise));
        mockResponseFactory.setup(m => m.createReadStream()).returns(() => mockStream);
        mockS3ClientFactory.setup(client => client.getObject(TypeMoq.It.isAny())).returns(() => mockResponseFactory.object);

        mockStream.push(s3Text);
        mockStream.push(null);
        return {s3Text, mockS3ClientFactory};
    }

    it('should get read stream from S3', done => {
        //Arrange
        const mockS3Url = "s3://mock-bucket/read-stream/mock-file.txt";
        const {s3Text, mockS3ClientFactory} = SetupS3Mock("Hello S3 Stream!");
        const s3Downloader: S3Downloader = new S3Downloader(mockS3ClientFactory.object);

        //Act
        s3Downloader.getS3Stream(mockS3Url)
            .then(stream => stringifyStream(stream))
            .then(text => {
                expect(text).toBe(s3Text);
                done();
            });
    });

    it("should ensure to download a file from S3 if the file doesn't exist in local storage", done => {
        const mockS3Url = "s3://mock-bucket/assert-file/s3-file.txt";
        const {s3Text, mockS3ClientFactory} = SetupS3Mock("Hello S3 File!");
        const s3Downloader: S3Downloader = new S3Downloader(mockS3ClientFactory.object);

        s3Downloader.assertFile("mocks", {fileName: "s3-file.txt", source: mockS3Url})
            .then((filePath) => {
                fsPromises.readFile(filePath)
                    .then((data) => expectBufferToMatchString(data, s3Text))
                    .then(() => fsPromises.unlink(filePath));
            })
            .then(() => mockS3ClientFactory.verify(mockObj => mockObj.getObject(TypeMoq.It.isAny()), Times.atLeastOnce()))
            .then(() => done());
    });

    it("should not download a file from S3 if the file exists in local storage", done => {
        const cachedText = "Hello Cached File!";
        const cachedPath = "mocks/existing-file.txt";

        const mockS3Url = "s3://mock-bucket/assert-file/s3-file.txt";
        const {mockS3ClientFactory} = SetupS3Mock("Hello S3 File!");
        const s3Downloader: S3Downloader = new S3Downloader(mockS3ClientFactory.object);

        fsPromises.writeFile(cachedPath,cachedText)
            .then(() => s3Downloader.assertFile("mocks", {fileName: "existing-file.txt", source: mockS3Url}))
            .then((filePath) => fsPromises.readFile(filePath))
            .then((data) => expectBufferToMatchString(data, cachedText))
            .then(() => mockS3ClientFactory.verify(mockObj => mockObj.getObject(TypeMoq.It.isAny()), Times.never()))
            .then(() => fsPromises.unlink(cachedPath))
            .then(() => done());
    });
});
