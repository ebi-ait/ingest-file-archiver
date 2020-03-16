import {ConvertFile, ConvertFilesJob, Fastq2BamParams} from "../common/types";
import {exec} from "child_process";
import Promise from "bluebird";
import R from "ramda";
import FileExistenceChecker from "./file-existence-checker";

class Fastq2BamConverter {
    fastq2BamPath: string;

    constructor(fastq2BamPath: string) {
        this.fastq2BamPath = fastq2BamPath;
    }

    assertBam(convertFilesJob: ConvertFilesJob): Promise<number> {
        return Fastq2BamConverter._checkBamExists(convertFilesJob.outputDir, convertFilesJob.outputName)
            .then((itExists) => {
                if (itExists) {
                    console.log(`.bam file with name ${convertFilesJob.outputName} already exists at ${convertFilesJob.outputDir}`);
                    return Promise.resolve(0);
                } else {
                    console.log(`Doing bam conversion for ${(R.map((read) => read.fileName, convertFilesJob.reads)).join(" ")}`);
                    return Fastq2BamConverter._convertFastq2Bam(convertFilesJob, this.fastq2BamPath);
                }
            });
    }

    static _checkBamExists(bamDir: string, bamName: string): Promise<boolean> {
        return FileExistenceChecker.fileExists(`${bamDir}/${bamName}`);
    }

    /**
     *
     * Performs a fastq-bam conversion, returns the result code in a process
     *
     * @param convertFilesJob
     * @param fastq2BamPath
     */
    static _convertFastq2Bam(convertFilesJob: ConvertFilesJob, fastq2BamPath: string): Promise<number> {
        return new Promise<number>((resolve, reject) => {
            const runParams: Fastq2BamParams = Fastq2BamConverter.fastq2BamParamsFromConvertRequest(convertFilesJob);
            const runArgs = Fastq2BamConverter.paramsToArgs(runParams);

            exec(fastq2BamPath + " " + runArgs.join(" "),
                {cwd: convertFilesJob.outputDir},
                (Err, stdout, stderr) => {
                    if (Err) {
                        reject(Err);
                    } else {
                        resolve(0);
                    }
                });
        });
    }

    /**
     * Just assuming 10xV2 for now
     */
    static bamSchemaParams(): string {
        return Fastq2BamConverter._10XV2Schema();
    }

    static _10XV2Schema(): string {
        return "10xV2";
    }

    static inputFastqParams(readsInfo: ConvertFile[]): Fastq2BamParams["inputFastqs"] {
        const readFilesFilterFn = (readInfo: ConvertFile) => readInfo.readIndex.startsWith("read");
        const indexFilesFilterFn = (readInfo: ConvertFile) => readInfo.readIndex.startsWith("index");
        const sortByReadIndexFn = R.sortBy(R.prop("readIndex"));

        const sortedReadFastqs = sortByReadIndexFn(R.filter(readFilesFilterFn, readsInfo));
        const sortedIndexFastqs = sortByReadIndexFn(R.filter(indexFilesFilterFn, readsInfo));

        return R.map((fastqReadInfo) => fastqReadInfo.fileName, sortedReadFastqs.concat(sortedIndexFastqs));
    }

    static paramsToArgs(params: Fastq2BamParams): string[] {
        let runArgs: string[] = [];

        runArgs = runArgs.concat(["-s", params.schema]);
        runArgs = runArgs.concat(["-b", params.outputBamFilename]);

        // args for the input fastqs
        const inputFastqs: string[] = params.inputFastqs;
        const fastqArgNums: string[] = R.map(argNum => `-${String(argNum)}`, R.range(1, inputFastqs.length + 1));
        const argNumFastqPairs: string[][] = R.zip(fastqArgNums, inputFastqs);

        runArgs = runArgs.concat(
            R.reduce(
                (acc: string[], item: string[]) => {
                    return acc.concat(item)
                },
                [],
                argNumFastqPairs
            )
        );

        return runArgs;
    }

    static fastq2BamParamsFromConvertRequest(convertFilesJob: ConvertFilesJob): Fastq2BamParams {
        return {
            schema: Fastq2BamConverter.bamSchemaParams(),
            outputBamFilename: convertFilesJob.outputName,
            inputFastqs: Fastq2BamConverter.inputFastqParams(convertFilesJob.reads)
        }
    }


}

export default Fastq2BamConverter;
