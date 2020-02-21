import * as AWS from "aws-sdk";
import S3Downloader from "./s3-downloader";
import {DownloadFile} from "../common/types";
import {PathLike, promises as fsPromises} from "fs";
import * as fs from "fs";

function expectFilesToMatch(actualFilePath: PathLike, exampleFilePath: PathLike): Promise<PathLike> {
    return new Promise<PathLike>(((resolve, reject) => {
        fsPromises.readFile(actualFilePath, "utf8")
            .then(actualContent => {
                fsPromises.readFile(exampleFilePath, "utf8")
                    .then(exampleContent => expect(actualContent).toMatch(exampleContent))
                    .then(() => resolve(actualFilePath))
            });
    }));
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

describe("S3 Integration Test", () => {
    afterAll(() => {
        deleteFolderRecursive("test/public-test");
    });

    it('should download from public s3 bucket',done => {
        const s3Downloader: S3Downloader = S3Downloader.default();
        const workingDir = s3Downloader.assertWorkingDirectory("test", "public-test");
        const exampleFilePath = "test/example.json";
        const file: DownloadFile = {
            fileName: "test-file.json",
            source: "s3://file-archiver-test/test-folder/test-file.json"
        };
        s3Downloader.assertFile(workingDir, file)
            .then((filePath) => expectFilesToMatch(filePath, exampleFilePath))
            .then(filePath => fsPromises.unlink(filePath))
            .then(() => done())
            .catch(error => fail(error))
    });
});
