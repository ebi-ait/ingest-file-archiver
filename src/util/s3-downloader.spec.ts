import S3Downloader from "./s3-downloader";

import {PathLike, promises as fsPromises} from "fs";

const writeMockFile = (mockFilePath: PathLike, mockFileContent: string) => {
    return fsPromises.writeFile(mockFilePath, mockFileContent);
};

describe("S3 downloader tests", () => {

    it("should parse Buckets and Key from s3 URLs", () => {
        const mockS3Url = new URL("s3://mock-bucket/mock-dir/mock-file.txt");
        const mockS3ObjectRequest = S3Downloader.s3ObjectRequest(mockS3Url);

        expect(mockS3ObjectRequest.Bucket).toBe("mock-bucket");
        expect(mockS3ObjectRequest.Key).toBe("mock-dir/mock-file.txt");
    });

    it("should check if a file exists", () => {
        const mockFileContent = "Hello World!";
        const mockFilePath = "mockfile.txt";

        writeMockFile(mockFilePath, mockFileContent).then(() => {
            S3Downloader.fileExists(mockFilePath)
                .then(exists => expect(exists).toBeTruthy());
        });
    });
});