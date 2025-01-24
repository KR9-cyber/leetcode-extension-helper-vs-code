const path = require("path");
const vscode = require("vscode");
const fs = require('fs');
const assert = require('assert');
const {runCodeCpp,runCodePython} = require('./codeexe.js');
const {scrapeData} = require('./webscrapping.js')

const getName = (url) =>{
    // Find the part between 'problems' and 'description'
    const start = url.indexOf('problems') + 'problems'.length + 1; // Adding 1 to skip the '/'
    const end = url.indexOf('description');
    let pName;
    if(url.slice(start, end)[start-end-1]=='/'){
        pName = url.slice(start, end-1);
    }
    else{
        pName = url.slice(start, end);
    }

    return pName;
};


function formatName(str){
	return str.toLowerCase().replace(/\s+/g, '-')
}

function getLanguage(filePath){
	const extension = path.extname(filePath).toLowerCase();

	if (extension === '.cpp'){
		return 'cpp'
	}else if (extension === '.py'){
		return 'python'
	}else if (extension === ".js"){
		return "javascript"
	}else {
		return "unknown"
	}
}


async function getTests(url) {
    // Show progress indicator
    await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: "Extracting Test Cases....",
            cancellable: false,
        },
        async (progress) => {
            try {
                const [inputArray, outputArray] = await scrapeData(url);
                const problemName = formatName(getName(url));

                const folderPath = getWorkspaceFolder();
                if (!folderPath) {
                    vscode.window.showErrorMessage('No folder or workspace is open.');
                    return;
                }

                const problemDir = prepareDirectories(folderPath, problemName);

                await createTestFiles(problemDir, inputArray, 'ip', progress);
                await createTestFiles(problemDir, outputArray, 'op', progress);

                vscode.window.showInformationMessage('Sample input and output are now present in the TestData folder 🎉');
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to extract test cases: ${error.message}`);
                console.error(error);
            }
        }
    );
}

// Helper to get the workspace folder
function getWorkspaceFolder() {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
        return null;
    }
    return workspaceFolders[0].uri.fsPath;
}

// Helper to prepare directories for test data
function prepareDirectories(baseFolder, problemName) {
    const testCasesFolder = path.join(baseFolder, 'TestData');
    if (!fs.existsSync(testCasesFolder)) {
        fs.mkdirSync(testCasesFolder, { recursive: true });
        console.log('TestData folder created.');
    }

    const problemDir = path.join(testCasesFolder, problemName);
    if (!fs.existsSync(problemDir)) {
        fs.mkdirSync(problemDir);
        console.log(`Folder for problem "${problemName}" created.`);
    }

    return problemDir;
}

// Helper to create test files
async function createTestFiles(directory, dataArray, prefix, progress) {
    for (let i = 0; i < dataArray.length; i++) {
        const fileName = `${prefix}${i + 1}.txt`;
        const filePath = path.join(directory, fileName);

        fs.writeFileSync(filePath, dataArray[i]);
        progress.report({
            increment: Math.floor(((i + 1) / dataArray.length) * 100),
            message: `Writing ${prefix} file ${i + 1}...`,
        });
    }
}


async function activate(context) {
    console.log('Extension "cph-lc" is now active! 🎉');

    // Command: Fetch Test Cases
    const getCases = vscode.commands.registerCommand('cph-lc.FetchTestCases', async () => {
        const url = await vscode.window.showInputBox({
            prompt: 'Enter the problem URL',
            placeHolder: 'https://example.com/problem/123',
        });

        if (!url) {
            vscode.window.showErrorMessage('URL is required to fetch test cases!');
            return;
        }

        await getTests(url);
    });

    // Command: Run Test Cases
    const runCases = vscode.commands.registerCommand('cph-lc.RunTestCases', async () => {
        const folderPath = getWorkspaceFolderPath();
        if (!folderPath) return;

        const editor = vscode.window.activeTextEditor;
        if (!editor || editor.document.getText().trim() === '') {
            vscode.window.showErrorMessage('No valid solution file open!');
            return;
        }

        const userCode = editor.document.getText();
        const problemName = await getProblemName();
        if (!problemName) return;

        const problemFolderPath = locateProblemFolder(folderPath, problemName);
        if (!problemFolderPath) return;

        const filePath = editor.document.uri.fsPath;
        const lang = getLanguage(filePath);

        if (lang === 'cpp') {
            await handleCppSolution(problemFolderPath, userCode);
        } else if (lang === 'python') {
            await runCodePython(filePath, problemFolderPath);
        } else {
            vscode.window.showErrorMessage(`Unsupported language: ${lang}`);
        }
    });

    context.subscriptions.push(getCases, runCases);
}

// Helper: Get workspace folder path
function getWorkspaceFolderPath() {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
        vscode.window.showErrorMessage('No folder or workspace is open.');
        return null;
    }
    return workspaceFolders[0].uri.fsPath;
}

// Helper: Prompt for problem name
async function getProblemName() {
    const problemName = await vscode.window.showInputBox({
        prompt: 'Enter the problem name',
    });

    if (!problemName) {
        vscode.window.showErrorMessage('Problem name is required!');
        return null;
    }

    return formatName(problemName);
}

// Helper: Locate problem folder
function locateProblemFolder(folderPath, problemName) {
    const testDataFolderPath = path.join(folderPath, 'TestData');
    if (!fs.existsSync(testDataFolderPath)) {
        vscode.window.showErrorMessage(`'TestData' folder not found in the workspace.`);
        return null;
    }

    const problemFolderPath = path.join(testDataFolderPath, problemName);
    if (!fs.existsSync(problemFolderPath)) {
        vscode.window.showErrorMessage(`Problem folder '${problemName}' not found inside 'TestData'.`);
        return null;
    }

    return problemFolderPath;
}

// Helper: Handle C++ solution
async function handleCppSolution(problemFolderPath, userCode) {
    const userSolutionFile = path.join(problemFolderPath, 'temp_solution.cpp');
    const executableFile = path.join(problemFolderPath, 'solution_exec.exe');

    fs.writeFileSync(userSolutionFile, userCode, 'utf8');
    await runCodeCpp(userSolutionFile, executableFile, problemFolderPath);
}

// This method is called when your extension is deactivated
function deactivate() {}

module.exports = { activate, deactivate };

// main extension code