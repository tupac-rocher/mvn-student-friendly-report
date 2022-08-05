const core = require('@actions/core');
const github = require('@actions/github');

const xml2js = require('xml2js');
const fs = require('fs');
const csv = require('csv-parser')
const parser = new xml2js.Parser({ attrkey: "ATTR" });
const HTMLParser = require('node-html-parser');

const test_coverage_treatment = require('./test_coverage_treatment')
const code_quality_treatment = require('./code_quality_treatment')
const code_smell_treatment = require('./code_smell_treatment')

//Inputs

const jacocoHtmlReport = 'target/site/jacoco/index.html'
const classMainFile = './main/class.csv'
const metricsXML = "metrics.xml"
const checkstyleResultXml = 'checkstyle-result-2.xml'
const designiteDesignCSCsv = "designCodeSmells-2.csv"
const designiteImplementationCSCsv = "implementationCodeSmells.csv"

// const jacocoHtmlReport = core.getInput('jacoco-html-report')
// const classMainFile = core.getInput('ck-main-class-csv')
// const metricsXML = core.getInput('metrics-xml')
// const checkstyleResultXml = core.getInput('checkstyle-result-xml')
// const designiteDesignResultCsv = core.getInput('designite-design-result-csv')
// const designiteImplementationResultCsv = core.getInput('designite-implementation-result-csv')


const roundNumber = (number) => {
    return Math.round((number + Number.EPSILON) * 100) / 100
}

Promise.all([
    test_coverage_treatment.getTestCoverageComment(jacocoHtmlReport),
    code_quality_treatment.getCodeQualityComment(checkstyleResultXml),
    code_smell_treatment.getCodeSmellComment(designiteDesignCSCsv,designiteImplementationCSCsv)
]).then((data) => {
    console.log(data[0])
    console.log(data[1])
    console.log(data[2])
}).catch((error) => {
    core.setFailed(error.message);
})
try{

    // Metrics treatment

    // Returns the select metrics for the methods from JaSoMe
    const getMethodMetrics = (metrics) => {
        // Metrics of the Method
        const metricNames = ['VG','NOP','NBD','Fin','Fout', 'TLOC']
        const selectedMetrics = metrics.filter((metric) => {
            return metricNames.includes(metric.ATTR.name)
        })

        const formattedMetrics = selectedMetrics.map((metric) => {
            return {
                [metric.ATTR.name] : metric.ATTR.value
            }
        })

        let assembledMetrics = {}

        for(let metric of formattedMetrics){
            assembledMetrics = {
                ...assembledMetrics,
                ...metric
            }
        }
        const methodMetrics = {
            TLOC: assembledMetrics.TLOC,
            NOP: assembledMetrics.NOP,
            NBD: assembledMetrics.NBD,
            FIN: assembledMetrics.Fin,
            FOUT: assembledMetrics.Fout,
            CC: assembledMetrics.VG
        }

        return methodMetrics
    }

    // Returns the classes and the methods with the selected metrics from JaSoMe
    const getjasomeDataFormatted = (data) => {

        const project = data['Project']
        const classes = []
        let methods = []

        // Extract main classes
        for(let currentPackage of project['Packages'][0]['Package']){

            for(let currentClass of currentPackage['Classes'][0]['Class']){
                // Only classes from the main folder
                if(!currentClass.ATTR.sourceFile.startsWith('./test')){

                    // Class

                    // Location
                    const sourceFile = currentClass.ATTR.sourceFile
                    const location = sourceFile.split('/java/')[1].replace(/\//g, ".").replace(/.java$/, '');

                    let newClass = {
                        location: location
                    }

                    // Metrics of the Class
                    const metricNames = ['AIF','MIF','Av','PMd','Md']
                    const metricsSelected = currentClass['Metrics'][0]['Metric'].filter((metric) => {
                        return metricNames.includes(metric.ATTR.name)
                    })

                    const metrics = metricsSelected.map((metric) => {
                        return {
                            [metric.ATTR.name] : metric.ATTR.value
                        }
                    })

                    let assembledMetrics = {}

                    for(let metric of metrics){
                        assembledMetrics = {
                            ...assembledMetrics,
                            ...metric
                        }
                    }

                    // Final object
                    newClass = {
                        ...newClass,
                        AIF: assembledMetrics.AIF,
                        MIF: assembledMetrics.MIF,
                        PA: assembledMetrics.Av,
                        MHF: 1 - (assembledMetrics.PMd / assembledMetrics.Md)
                    }
                    classes.push(newClass)

                    // Methods

                    let classMethods = currentClass['Methods'][0]['Method']
                    classMethods = classMethods.map((method) => {
                        const metricsToTreat = method['Metrics'][0]['Metric']
                        const metrics = getMethodMetrics(metricsToTreat)
                        const newMethod = {
                            location: location,
                            line: method.ATTR.lineStart,
                            name: method.ATTR.name,
                            ...metrics
                        }
                        return newMethod
                    })
                    methods = methods.concat(classMethods)
                }
            }
        }
        return {
            classes: classes,
            methods: methods
        }
    }

    // Returns the classes and the methods with the selected metrics from JaSoMe out of a Promise
    const jasomeDataFormat = (jasomeXMLFile) => {
        return new Promise(function(resolve, reject){
            let metricsFile = fs.readFileSync(jasomeXMLFile, "utf8");
            parser.parseString(metricsFile, function(error, result) {
                if(error){
                    core.setFailed(error.message);
                    reject(error);
                    
                }
                else {
                    const dataFormatted = getjasomeDataFormatted(result)
                    resolve(dataFormatted);
                }
            })
        });
    }

    // Returns the classes with the selected metrics from CK out of Promise
    const ckMainClassDataFormat = (ckMainClassFile) => {
        const stream = fs.createReadStream(ckMainClassFile)
        let classes = []
        return new Promise((resolve) => {
            stream
                .pipe(csv({}))
                .on('data', function(data) {
                    const newClass = {
                        location: data['class'],
                        fanin: data['fanin'],
                        fanout: data['fanout'],
                        tcc: data['tcc']
                    }
                    classes.push(newClass)
                })
                .on('end', function() {
                  resolve(classes);
                });
          });

    }

    // Returns a formatted String to output the metrics of each class
    const getClassMetricsComment = (classes) => {
        let comment = ''
        // Ttitle
        comment += '### Classes\n'
        // Header
        comment += '| Class | FAN-IN | FAN-OUT | TCC | MIF | Public Attributes | MHF |\n'
        comment += ' | - | - | - | - | - | - | - | -  |\n'
        for(let currentClass of classes){
            comment += currentClass.location + ' | ' + 
                       currentClass.fanin + ' | ' + 
                       currentClass.fanout + ' | ' + 
                       Number.isNaN(currentClass.tcc) ? 'Not enough methods' : roundNumber(currentClass.tcc) + ' | ' + 
                       roundNumber(currentClass.MIF) + ' | ' + 
                       currentClass.PA + ' | ' + 
                       roundNumber(currentClass.MHF) + ' |\n' 
        }
        return comment
    }

    // Returns a formatted String to output the metrics of each method
    const getMethodMetricsComment = (methods) => {

        let comment = ''
        // Ttitle
        comment += '### Methods\n'
        // Header
        comment += '| Class | Method | FAN-IN | FAN-OUT | Total Lines of Code | NOP | NBD | McCabe Cyclomatic Complexity |\n'
        comment += ' | - | - | - | - | - | - | - | -  |\n'
        for(let currentMethod of methods){
            comment += currentMethod.location + ' | ' + 
                       currentMethod.name + ' | ' + 
                       currentMethod.FIN + ' | ' + 
                       currentMethod.FOUT + ' | ' + 
                       currentMethod.TLOC + ' | ' + 
                       currentMethod.NOP + ' | ' + 
                       currentMethod.NBD + ' | ' + 
                       currentMethod.CC + ' |\n' 
        }
        return comment

    }

    const outputMetricComment = (metricsXMLFile, ckMainFile) => {
        // wait until all formatted data have been retrieved, then continue
        Promise.all(
            [
                jasomeDataFormat(metricsXMLFile),
                ckMainClassDataFormat(ckMainFile)
            ]
        )
            .then(function (data) {                
                const jasomeData = data[0]
                const ckData = data[1]

                // merge classes
                const classes = ckData.map((currentClass) => {
                    const classToMerge = jasomeData.classes.find((currentJaSoMeClass) => {
                        return currentJaSoMeClass.location === currentClass.location
                    })
                    const newClass = {
                        ...currentClass,
                        ...classToMerge
                    }
                    return newClass
                })

                const classMetricsComment = getClassMetricsComment(classes)
                const methodMetricsComment = getMethodMetricsComment(jasomeData.methods)
                
                const metricsFormattedComment = classMetricsComment + methodMetricsComment
                core.setOutput("metrics-comment", metricsFormattedComment);
   
        });
    }
    outputMetricComment(metricsXML, classMainFile)

} catch (error) {
    core.setFailed(error.message);
}