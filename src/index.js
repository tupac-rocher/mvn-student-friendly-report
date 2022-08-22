const core = require('@actions/core');
const github = require('@actions/github');

const test_coverage_treatment = require('./test_coverage_treatment')
const design_metric_treatment = require('./design_metric_treatment')
const code_style_treatment = require('./code_style_treatment')
const code_smell_treatment = require('./code_smell_treatment')

//Inputs

const jacocoHtmlReport = core.getInput('jacoco-html-report')
const classMainFile = core.getInput('ck-main-class-csv')
const metricsXML = core.getInput('metrics-xml')
const checkstyleResultXml = core.getInput('checkstyle-result-xml')
const designiteDesignResultCsv = core.getInput('designite-design-result-csv')
const designiteImplementationResultCsv = core.getInput('designite-implementation-result-csv')

/**
 * This method triggers the action
 */
const run = () => {
    Promise.all([
        test_coverage_treatment.getTestCoverageComment(jacocoHtmlReport),
        design_metric_treatment.getDesignMetricComment(classMainFile, metricsXML),
        code_style_treatment.getCodeStyleComment(checkstyleResultXml),
        code_smell_treatment.getCodeSmellComment(designiteDesignResultCsv,designiteImplementationResultCsv)
    
    ]).then((data) => {
        const  report = '# Report\n' +
        'You can find below the quality assessment of the project with regards to test coverage, design metrics, code style and code smells.\n'+
        'For more information check the [documentation](https://github.com/tupac-rocher/student-friendly-pipeline-example#feedback-report)\n'+
        data[0] + 
        data[1] +
        data[2] +
        data[3]
        core.setOutput("report-comment", report);
    }).catch((error) => {
        core.setFailed(error.message);
    })
}

run()


