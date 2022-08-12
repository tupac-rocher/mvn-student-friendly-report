const fs = require('fs');
const HTMLParser = require('node-html-parser');

/**
 * 
 * @param {String} testCoveragePercentage contains the percentage of test coverage
 * @returns {String} A markdown formatted String representing the test coverage comment section
 */
const generateTestCoverageComment = (testCoveragePercentage) => {
    const testCoverageComment = 
    `## Test Coverage\n| Total coverage | ${ testCoveragePercentage } |\n|:-|:-:|\n`
    return testCoverageComment
}

/**
 * 
 * @param {String} jacocoHtmlReport the path to the corresponding file
 * @returns {Promise} A Promise that resolves a String corresponding to the test coverage percentage (ex: '50 %')
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
                reject(err);
            } 
        })
    })
}

/**
 * 
 * @param {String} jacocoHtmlReport the path to the corresponding HTML file
 * @returns {Promise} A Promise that resolves a Markdown formatted String representing the test coverage comment section
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