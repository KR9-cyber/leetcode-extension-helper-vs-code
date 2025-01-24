const puppeteer = require('puppeteer');


function getArrayDimensions(arr) {
    if (!Array.isArray(arr) || arr.length === 0) return [];
    return [arr.length, ...getArrayDimensions(arr[0])];
}



function* flattenArray(nested) {
    for (const item of nested) {
        if (Array.isArray(item)) {
            yield* flattenArray(item);
        } else {
            yield item;
        }
    }
}


function processInput(input) {
    input += ",";
    const result = [];
    let idx = 0;

    while (idx < input.length) {
        const char = input[idx];

        if (char === "=") {
            idx += 2; // Skip "=" and the following space

            let extracted = "";
            let arrayDepth = 0;

            while (input[idx] === "[") {
                idx++;
                arrayDepth++;
            }

            if (arrayDepth > 0) {
                idx -= arrayDepth;
                extracted = "";
                const closing = "]".repeat(arrayDepth);

                while (input.slice(idx, idx + arrayDepth) !== closing) {
                    extracted += input[idx];
                    idx++;
                }
                extracted += closing;

                const parsedArray = JSON.parse(extracted);
                const dimensions = getArrayDimensions(parsedArray);

                if (dimensions.length !== arrayDepth && (dimensions.length === 0 && arrayDepth !== 1)) {
                    throw new Error("Array dimensions mismatch");
                }

                const flattened = [...flattenArray(parsedArray)];
                const dimensionInfo = dimensions.join(" ") + " " + flattened.join(" ");
                result.push(dimensionInfo);
            } else {
                if (input[idx] === '"') {
                    idx++;
                    while (input[idx] !== '"') {
                        extracted += input[idx];
                        idx++;
                    }
                } else {
                    while (input[idx] !== ",") {
                        extracted += input[idx];
                        idx++;
                    }
                }
                result.push(extracted);
            }
            idx++;
        } else {
            idx++;
        }
    }
    return result.join(" ");
}



async function scrapeData(url) {
    if (!url || typeof url !== "string") {
        console.error("Invalid or missing URL. Process terminated.");
        return;
    }

    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();

    try {
        await page.goto(url);
        const elements = await page.$$('.elfjS pre');

        const inputs = [];
        const outputs = [];
        console.log("Number of elements:", elements.length);

        for (const element of elements) {
            const textContent = await page.evaluate(el => el.textContent, element);
            const cleanedText = textContent.replace(/(Input:|Output:|Explanation:)\s*/g, '').trim();
            const [rawInput, rawOutput] = cleanedText.split('\n');

            console.log(rawInput);
            console.log(rawOutput);

            let processedOutput = rawOutput.startsWith('[') ? JSON.parse(rawOutput) : rawOutput;

            if (Array.isArray(processedOutput)) {
                const dimensions = getArrayDimensions(processedOutput);
                processedOutput = dimensions.length > 1
                    ? processedOutput.map(subArr => subArr.join(' ')).join('\n')
                    : processedOutput.join(' ');
            } else if (typeof processedOutput === 'string' && processedOutput.startsWith('"')) {
                processedOutput = processedOutput.slice(1, -1);
            }

            inputs.push(processInput(rawInput));
            outputs.push(processedOutput);
        }

        console.log([inputs, outputs]);
        return [inputs, outputs];

    } catch (error) {
        console.error("An error occurred during the scraping process:", error);
    } finally {
        await browser.close();
    }
}

module.exports = { scrapeData };


// code used for scraping web