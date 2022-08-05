// Checkstyle file treatment

const getCommentFromErrors = (errors) => {
    let errorsComment = ""
    let errorNames = errors.map((error) => {
        return error.errorType
    })
    errorNames = [... new Set(errorNames)]
    for (let currentError of errorNames){
        errorsComment += '\n\n### ' + currentError + '\n'
        const currentErrors = errors.filter((error) => {
            if(currentError === error.errorType){
                errorsComment += '- ' + error.fileName + ' ('+ error.line + ':' + error.column + ')\n'
                return error
            }
        })
    }
    return errorsComment
}

const getFormattedFileObject = (file) => {
    const errors = []

    const fileName = file.ATTR.name.split('/java/')[1].replace(/\//g, ".")
    if(file.error){
        for (let error of file.error){
            const attributes = error.ATTR
    
            const newErrorData = {}
            newErrorData.fileName = fileName
            newErrorData.line = attributes.line? attributes.line : '0'
            newErrorData.column = attributes.column? attributes.column : '0'
            const source = attributes.source.split('.')
            const errorType = source[6]
            // add whitespaces
            .replace(/([A-Z])/g, ' $1')
            // uppercase the first character
            .replace(/^./, function(str){ return str.toUpperCase(); })
            // remove the ending 'Check'
            .replace("Check", "")
            newErrorData.errorType = errorType
            newErrorData.message = attributes.message
            errors.push(newErrorData)
        }
    }
    
    return errors
}



    let xml_string = fs.readFileSync(checkstyleResultXml, "utf8");

    parser.parseString(xml_string, function(error, result) {
        if(error === null) {
            if(result.checkstyle){
                const report = result.checkstyle
                if(report.file){
                    let checkstyleFormattedComment = ""
                    let errors = []
                    if(Array.isArray(report.file)){
                        for(let file of report.file){
                            errors = errors.concat(getFormattedFileObject(file))
                        }
                    }
                    else{
                        errors = errors.concat(getFormattedFileObject(file))
                    }


                    checkstyleFormattedComment = getCommentFromErrors(errors)
                    checkstyleFormattedComment += '\n'
                    core.setOutput("checkstyle-comment", checkstyleFormattedComment);
                }
            }
        }
        else {
            core.setFailed(error.message);
        }
    });

    module.exports = { getCodeQualityComment };