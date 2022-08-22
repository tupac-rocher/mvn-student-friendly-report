const fs = require('fs');
const xml2js = require('xml2js');
const parser = new xml2js.Parser({ attrkey: "ATTR" });

/**
 * 
 * @param {String} rawIssueName from the 'source' attribute of the 'error' object
 * @returns {String} a formatted String from rawIssueName in order to get only the name, 
 * ex: com.puppycrawl.tools.checkstyle.checks.naming.AbstractClassNameCheck 
 * -> Abstract Class Name 
 */
const formatIssueName = (rawIssueName) => {
    const issueName = 
    rawIssueName.split('.')[6]
        // add whitespaces
        .replace(/([A-Z])/g, ' $1')
        // uppercase the first character
        .replace(/^./, function(str){ return str.toUpperCase(); })
        // remove the ending 'Check'
        .replace("Check", "")
    return issueName
}

/**
 * 
 * @param {[Object]} issues an Array containing issues of type Object with the following data structure
 * {
 *      name : String
 *      locations : [
 *          {
 *              fileName: String
 *              line: String
 *              column: String
 *              message: String  
 *          } 
 *      ]
 * }
 * @returns {String} A markdown formatted String representing the code style comment section
 */
const generateCodeStyleComment = (issues) => {
    let codeStyleComment = '## Code Style\n'
    for(let issue of issues){
        codeStyleComment +='\n\n### ' + issue.name + '\n'
        for(let location of issue.locations){
            codeStyleComment += '- ' + location.fileName + ' ('+ location.line + ':' + location.column + ')\n'
            codeStyleComment += location.message + '\n'
        }
    }
    return codeStyleComment
}


/**
 * 
 * @param {String} issueName
 * @param {[Object]} fileObjectIssues 
 * @returns {[Object]} a list of Object corresponding to the location occurences (file information) of an issue
 * {
 *      fileName: String
 *      line: String
 *      column: String
 *      message: String
 * }
 */
const getIssueLocations = (issueName, fileObjectIssues) => {
    const filteredFileObjectIssues =  fileObjectIssues.filter((fileObjectIssue) => {
        return fileObjectIssue.issueName === issueName
    })
    return filteredFileObjectIssues.map((fileObjectIssue) => {
        const { issueName, ...location} = fileObjectIssue
        return location
    })

}

/**
 * 
 * @param {[String]} reportedIssueSet a set of the reported issues
 * @param {[Object]} fileObjectIssues a list of file Object with the following structure
 * {
 *      issueName: String
 *      fileName: String
 *      line: String
 *      column: String
 *      message: String  
 * }
 * @returns {[Object]} an Array containing issues of type Object with the following data structure
 * {
 *      name : String
 *      locations : [
 *          {
 *              fileName: String
 *              line: String
 *              column: String
 *              message: String  
 *          } 
 *      ]
 * }
 */
const getFormattedIssues = (reportedIssueSet, fileObjectIssues) => {
    const issues = []
    for(let issueName of reportedIssueSet){
        const newIssue = {
            name: issueName,
            locations: getIssueLocations(issueName, fileObjectIssues)
        }
        issues.push(newIssue)

    }
    return issues
}

/**
 * 
 * @param {[Object]} fileObjectIssues an Array containing issues of type Object with the following data structure
 * {
 *      issueName: String
 *      fileName: String
 *      line: String
 *      column: String
 *      message: String  
 * }
 * @returns {[String]} a set of the reported issues
 */
const getReportedIssueSet = (fileObjectIssues) => {
    const issueNames =  fileObjectIssues.map((issue) => {
        return issue.issueName
    })
    return [... new Set(issueNames)] 
}

/**
 * 
 * @param {String} rawName from the 'name' attribute of the 'file' object
 * @returns {String} a formatted String from rawName in order to get the path of the file starting from the main/java folder
 */
const getFormattedFileName = (rawName) => {
    return rawName.split('/java/')[1].replace(/\//g, ".")
}

/**
 * 
 * @param {[Object]} files an Array of Object with the following structure
 * {
 *      ATTR:{
 *              name: String
 *          }
 *      error: [
 *          ATTR:{
 *              severity: String
 *              column: String
 *              message: String
 *              source: String
 *          }
 *      ]
 * }
 * @returns {[Object]}  an Array containing issues of type Object with the following data structure
 * {
 *      issueName: String
 *      fileName: String
 *      line: String
 *      column: String
 *      message: String  
 * }
 */
const getFileObjectIssues = (files) => {
    let issues = []
    for(let file of files){
        const fileName = getFormattedFileName(file.ATTR.name)
        if(file.error){
            const issuesFromFile = file.error.map((err) => {
                    return {
                        issueName: formatIssueName(err.ATTR.source),
                        fileName: fileName,
                        line: err.ATTR.line? err.ATTR.line : '0',
                        column: err.ATTR.column? err.ATTR.column : '0',
                        message: err.ATTR.message
                    }
            })
            issues = issues.concat(issuesFromFile)
        }
    }
    return issues
    
}

/**
 * 
 * @param {String} checkstyleResultXml the path to the corresponding XML file
 * @returns {Promise} that resolves with an array of Object with the following structure
 * {
 *      name : String
 *      locations : [
 *          {
 *              fileName: String
 *              line: String
 *              column: String
 *              message: String  
 *          } 
 *      ]
 * }
 */
const getCodeStyleIssues = (checkstyleResultXml) => {
    return new Promise((resolve, reject) => {
        const xml_string = fs.readFileSync(checkstyleResultXml, "utf8");
        parser.parseString(xml_string, function(error, result) {
            if(error !== null) {
                reject(error)
                return
            }
            if(!result.checkstyle){
                reject("object 'result' does not have a 'checkstyle' property")
                return
            }
            const report = result.checkstyle
            if(!report.file){
                reject("object 'checkstyle' does not have a 'file' property")
                return
            }
            const files = report.file
            const fileObjectIssues = getFileObjectIssues(files)
            const reportedIssueSet = getReportedIssueSet(fileObjectIssues)
            resolve(getFormattedIssues(reportedIssueSet, fileObjectIssues))
        });
    })
}

/**
 * 
 * @param {String} checkstyleResultXml the path to the corresponding XML file
 * @returns {Promise} that resolves with a Markdown formatted String corresponding to the code style section
 */
const getCodeStyleComment = (checkstyleResultXml) => {
    return new Promise((resolve, reject) => {
        getCodeStyleIssues(checkstyleResultXml)
        .then((issues) => {
            resolve(generateCodeStyleComment(issues))
        })
        .catch((error) => {
            reject(error)
        })
    })
}

module.exports = { getCodeStyleComment };