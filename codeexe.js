/* eslint-disable no-unused-vars */
const fs = require('fs');
const path = require('path');
const vscode = require('vscode');
const {spawn} = require('child_process');

function displayResults(allTestsPassed) {
    if (allTestsPassed) {
        vscode.window.showInformationMessage('All test cases passed!');
    } else {
        vscode.window.showErrorMessage('Some test cases failed. Please check your code.');
    }
}

function updateStatusBar(allTestsPassed) {
    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    statusBarItem.text = allTestsPassed ? '$(check) All tests passed!' : '$(x) Some tests failed.';
    statusBarItem.tooltip = 'Click to view details';
    statusBarItem.show();

    // statusBarItem.command = 'extension.showTestDetails'; // replace with your command ID
}

function writeResultsToOutputPanel(results,outputs,counter) {
    const outputChannel = vscode.window.createOutputChannel('Test Results');
    outputChannel.clear();
    outputChannel.appendLine('                Results                ');
    results.forEach((result, index) => {
        const { testCase, passed } = result;
        const {expectedOutput,actualOutput} = outputs[index];
        if(passed){
            outputChannel.appendLine(`Test Case ${index + 1}: ✅`);
        }
        else{
            outputChannel.appendLine(`Test Case ${index + 1}: ❌`);
            outputChannel.appendLine(`Expected: ${expectedOutput}`);
            outputChannel.appendLine(` Actual : ${actualOutput}`);
        }
    });
    outputChannel.show(); // Focus on the output panel
}

async function runCodeCpp(userSolutionFile, executableFile, problemFolderPath) {

    // Compile the C++ code
    const compileProcess = spawn('g++', [userSolutionFile, '-o', executableFile]);

    await new Promise((resolve, reject) => {
        compileProcess.on('close', (code) => {
            if (code === 0) {
                console.log('Compilation successful.');
                resolve();
            } else {
                console.error('Compilation failed.');
                reject(new Error('Compilation error.'));
            }
        });

        compileProcess.stderr.on('data', (data) => {
            console.error(`Compilation Error: ${data.toString()}`);
        });
    });

    const inputFiles = fs.readdirSync(problemFolderPath).filter(file => file.startsWith('ip') && file.endsWith('.txt'));
    let allTestsPassed = true;

    const results = []
    const outputs = []

    for (const inputFile of inputFiles) {
        const testCaseNumber = inputFile.match(/\d+/)[0]; // Extract test case number
        const expectedOutputFile = `op${testCaseNumber}.txt`;

        const inputPath = path.join(problemFolderPath, inputFile);
        const outputPath = path.join(problemFolderPath, expectedOutputFile);

        if (!fs.existsSync(outputPath)) {
            console.error(`Expected output file ${expectedOutputFile} not found.`);
            continue;
        }

        const inputContent = fs.readFileSync(inputPath, 'utf-8');
        const expectedOutput = fs.readFileSync(outputPath, 'utf-8').trim();
        console.log(inputContent);
        console.log(expectedOutput);
        
        console.log(`Running test case ${testCaseNumber}...`);

        const child = spawn(executableFile);

        let actualOutput = '';
        child.stdout.on('data', (data) => {
            actualOutput += data.toString();
        });

        child.stderr.on('data', (data) => {
            console.error(`Error in test case ${testCaseNumber}: ${data}`);
        });

        child.on('close', (code) => {
            actualOutput = actualOutput.trim();

            const passed = (actualOutput === expectedOutput);

            outputs.push({actualOutput,expectedOutput});

            if (passed) {
                console.log(`Test case ${testCaseNumber} passed!`);
            } else {
                console.error(`Test case ${testCaseNumber} failed.`);
                console.error(`Expected: ${expectedOutput}`);
                console.error(`Got: ${actualOutput}`);
                allTestsPassed = false;
            }
            results.push({ testCase: testCaseNumber, passed });
        });

        // Send input to the program
        child.stdin.write(inputContent);
        child.stdin.end();

        // Wait for the process to finish before running the next test case
        await new Promise((resolve) => child.on('close', resolve));
    }

    // Display Results
    displayResults(allTestsPassed);
    updateStatusBar(allTestsPassed);
    writeResultsToOutputPanel(results,outputs);
}

async function runCodePython(scriptPath,problemFolderPath) {

    const inputFiles = fs.readdirSync(problemFolderPath).filter(file => file.startsWith('ip') && file.endsWith('.txt'));
    let allTestsPassed = true;
    const results = []
    const outputs = []

    for (const inputFile of inputFiles) {
        const testCaseNumber = inputFile.match(/\d+/)[0]; // Extract test case number
        const expectedOutputFile = `op${testCaseNumber}.txt`;

        const inputPath = path.join(problemFolderPath, inputFile);
        const outputPath = path.join(problemFolderPath, expectedOutputFile);

        if (!fs.existsSync(outputPath)) {
            console.error(`Expected output file ${expectedOutputFile} not found.`);
            continue;
        }

        const inputContent = fs.readFileSync(inputPath, 'utf-8');
        const expectedOutput = fs.readFileSync(outputPath, 'utf-8').trim();

        console.log(`Running test case ${testCaseNumber}...`);

        let actualOutput = '';
        let errorOutput = '';

        await new Promise((resolve, reject) => {
            const process = spawn('python', [scriptPath]);

            process.stdout.on('data', (data) => {
                actualOutput += data.toString();
            });

            process.stderr.on('data', (data) => {
                errorOutput += data.toString();
            });

            process.on('close', (code) => {
                if (errorOutput) {
                    console.error(`stderr: ${errorOutput}`);
                    reject(new Error(`Test case ${testCaseNumber} encountered an error.`));
                } else {
                    actualOutput = actualOutput.trim();

                    const passed = (actualOutput === expectedOutput);
                    outputs.push({expectedOutput,actualOutput});
                    if (passed) {
                        console.log(`Test case ${testCaseNumber} passed!`);
                    } else {
                        console.error(`Test case ${testCaseNumber} failed.`);
                        console.error(`Expected: ${expectedOutput}`);
                        console.error(`Got: ${actualOutput}`);
                        allTestsPassed = false;
                    }
                    results.push({ testCase: testCaseNumber, passed });
                    resolve();
                }
            });

            // Send input to the program
            process.stdin.write(inputContent);
            process.stdin.end();
        });
    }

    // Display Results
    displayResults(allTestsPassed);
    updateStatusBar(allTestsPassed);
    writeResultsToOutputPanel(results,outputs);
}


module.exports = {runCodeCpp,runCodePython};

// code used to run the soulution file