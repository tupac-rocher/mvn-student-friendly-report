const fs = require('fs');
const HTMLParser = require('node-html-parser');

/**
 * 
 * @param testCoveragePercentage 
 * @returns A markdown formatted String representing the test coverage comment section
 */
const generateTestCoverageComment = (testCoveragePercentage) => {
    const testCoverageComment = 
    `## Test Coverage\n| Total coverage | ${ testCoveragePercentage } |\n|:-|:-:|\n`
    return testCoverageComment
}

/**
 * 
 * @param jacocoHtmlReport 
 * @returns A Promise that resolves a String corresponding to the test coverage percentage (ex: '50 %')
 */
const getTestCoveragePercentage = (jacocoHtmlReport) => {
    return new Promise( function(resolve, reject){
        fs.readFile(jacocoHtmlReport, 'utf8', function(err, html){
            if(err === null) { 
                /**
                 * Reading the html in order to get the test coverage percentage
                 */
                const root = HTMLParser.parse(html)
                const testCoveragePercentage = root.querySelector('#c0').childNodes[0]._rawText
                resolve(testCoveragePercentage);
            }
            else {
                reject(error.message);
            } 
        })
    })
}

/**
 * 
 * @param jacocoHtmlReport 
 * @returns A Promise that resolves a Markdown formatted String representing the test coverage comment section
 */
const getTestCoverageComment = (jacocoHtmlReport) => {
    return new Promise(function(resolve, reject){
        getTestCoveragePercentage(jacocoHtmlReport)
        .then((testCoveragePercentage) => {
            resolve(generateTestCoverageComment(testCoveragePercentage))
        })
        .catch((error) =>{
            reject(error.message)
        })
    })    
}

module.exports = { getTestCoverageComment };