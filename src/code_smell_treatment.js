const fs = require('fs');
const csv = require('csv-parser')


/**
 * 
 * @param {[Object]} data containing the design code smells with the following data structure (raw from the file)
 * {
 *      'Project Name' : String
 *      'Package Name': String
 *      'Type Name': String
 *      'Code Smell': String
 * }
 * @returns {[Object]} containing the restructured code smell objects with the following structure
 * {
 *      name: String
 *      files: [String]
 * }
 */
const getDesignCodeSmells = (data) => {
    const codeSmells = []

    // List of design code smells reported
    let codeSmellsReported = [... new Set(data.map((result) => result['Code Smell']))]

    for(let codeSmell of codeSmellsReported){
        const newCodeSmell = {
            name: codeSmell,
            files: []
        }
        for(let result of data){
            if(result['Code Smell'] === codeSmell){
                newCodeSmell.files.push(result['Package Name'] + '.' + result['Type Name'])
            }
        }
        codeSmells.push(newCodeSmell)
        
    }
    return codeSmells
}

/**
 * 
 * @param {String} file the path to the CSV file containing the result of the design code smell analysis from Designite
 * @returns {Promise} A Promise that resolves with an array of design code smells having the following data structure
 * {
 *      name: String
 *      files: [String]
 * }
 * 
 */
const designCodeSmellFormat = (file) => {
    return new Promise(function(resolve, reject){
        const results = []
        fs.createReadStream(file)
            .pipe(csv({}))
            .on('error', function(error){
                reject(error)
            })
            .on('data', (data) => results.push(data))
            .on('end', () => {
                const dataFormatted = getDesignCodeSmells(results)
                resolve(dataFormatted);
        })
    });
}


/**
 * 
 * @param {[Object]} data containing the implementation code smells with the following data structure (raw from the file)
 * {
 *      'Project Name' : String
 *      'Package Name': String
 *      'Type Name': String
 *      'Code Smell': String
 * }
 * @returns {[Object]} containing the restructured code smell objects with the following structure
 * {
 *      name: String
 *      files: [String]
 * }
 */
const getImplementationCodeSmells = (data) => {
    const codeSmells = []

    // List of design code smells reported
    let codeSmellsReported = [... new Set(data.map((result) => result['Code Smell']))]

    // List of implementation smells to filter out
    let unchosenCodeSmells = ['Abstract Function Call From Constructor']

    for(let codeSmell of codeSmellsReported){
        // Only chosen code smells
        if(!unchosenCodeSmells.includes(codeSmell)){
            const newCodeSmell = {
                name: codeSmell,
                files: []
            }
            for(let result of data){
                if(result['Code Smell'] === codeSmell){
                    newCodeSmell.files.push(result['Package Name'] + '.' + result['Type Name'] + '.' + result['Method Name'])
                }
            }
            codeSmells.push(newCodeSmell)
        }
        
    }
    return codeSmells
}

/**
 * 
 * @param {String} file the path to the CSV file containing the result of the implementation code smell analysis from Designite
 * @returns {Promise} A Promise that resolves with an array of implementation code smells having the following data structure
 * {
 *      name: String
 *      files: [String]
 * }
 * 
 */
const implementationCodeSmellFormat = (file) => {
    return new Promise(function(resolve, reject){
        const results = []
        fs.createReadStream(file)
            .pipe(csv({}))
            .on('error', function(error){
                reject(error)
            })
            .on('data', (data) => results.push(data))
            .on('end', () => {
                const dataFormatted = getImplementationCodeSmells(results)
                resolve(dataFormatted);
        })
    });
}

/**
 * 
 * @param {String} title of the sub-section
 * @param {[Object]} data a list of code smells having the following structure
 * {
 *      name: String
 *      files: [String]
 * }
 * @returns {String} a Markdown formatted String containing the sub section of the code smells section
 */
const generateSubSectionComment = (title, data) => {
    let comment = ''
    if(data.length !== 0){
        comment += "### "+ title +"\n"
        for(let codeSmell of data){
            comment += "#### " + codeSmell.name + "\n"
            if(codeSmell.files){
                for(let file of codeSmell.files){
                    comment += " - " + file + "\n"
                }
            } 
        }
        comment += '\n'
    }
    return comment
}

/**
 * 
 * @param {[Object]} designCodeSmells  a list of code smells having the following structure
 * {
 *      name: String
 *      files: [String]
 * }
 * @param {[Object]} implementationCodeSmells  a list of code smells having the following structure
 * {
 *      name: String
 *      files: [String]
 * }
 * @returns {String} A Markdown formatted String containing the code smell section
 */
const generateCodeSmellComment = (designCodeSmells, implementationCodeSmells) => {
    let codeSmellsComment = '## Code smells\n\n'
    codeSmellsComment += generateSubSectionComment('Design', designCodeSmells)
    codeSmellsComment +=  generateSubSectionComment('Implementation', implementationCodeSmells)
    return codeSmellsComment
}

/**
 * 
 * @param {String} designCodeSmellsFile the path to the corresponding CSV file
 * @param {String} implementationCodeSmellFile the path to the corresponding CSV file
 * @returns {Promise} that resolves with a Markdown formatted String corresponding to the code smell section
 */
const getCodeSmellComment = (designCodeSmellFile, implementationCodeSmellFile) => {
    return new Promise((resolve, reject) => {
        Promise.all(
            [
                designCodeSmellFormat(designCodeSmellFile),
                implementationCodeSmellFormat(implementationCodeSmellFile)
            ]
        ).then( function (data) {
            let codeSmellsComment = generateCodeSmellComment(data[0], data[1])
            resolve(codeSmellsComment)
        })
        .catch( function (error) {
            reject(error)
        })
    })
    
}

module.exports = { getCodeSmellComment };