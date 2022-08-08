
# mvn-format-xml-reports

This action treats information from files generated by different Maven plugins. It ouputs variables of type String to visualize the information under the Markdown format.
The plugins are listed below:

- [jacoco-maven-plugin](https://www.eclemma.org/jacoco/trunk/doc/maven.html)
- [ck-mvn-plugin](https://github.com/jazzmuesli/ck-mvn-plugin)
- [JaSoMe](https://github.com/rodhilton/jasome)
- [Apache Maven Checkstyle Plugin](https://maven.apache.org/plugins/maven-checkstyle-plugin/)
- [DesigniteJava](https://github.com/tushartushar/DesigniteJava)

You can use it in your Github Actions workflow.

## Inputs

| File                    | Generated by | Description                                                    |
| ----------------------- | ------------ | - |
| `jacoco-html-report`    | Jacoco plugin |**Required** The file corresponding<br/> to the analysis of the test coverage:<br> - /target/site/jacoco/index.html
| `ck-main-class-csv`     | ck-mvn-plugin |**Required** The file corresponding<br/> to the analysis of the classes in the **main folder**:<br> - /src/main/java/class.csv |
| `metrics-xml`           | JaSoMe |**Required** The file corresponding<br/> to the analysis of the src folder:<br> - /metrics.xml |
| `checkstyle-result-xml` | Apache Maven Checkstyle Plugin |**Required** The <br/>file corresponding to the analysis of **code quality**:<br> - /target/checkstyle-result.xml |
| `designite-design-result-csv` |  DesigniteJava | **Required** The file corresponding<br/> to the analysis of **design smells**:<br> - /target/designite/designCodeSmells.csv |
| `designite-implementation-result-csv`| DesigniteJava | **Required** The file corresponding<br/> to the analysis of **implementation smells**:<br> - /target/designite/implementationCodeSmells.csv |

## Outputs

| Variable                | Description                                                    |   
| ----------------------- | -------------------------------------------------------------- |
| `report-comment` | A Markdown formatted String displaying the report composed of 4 categories:<br> - test coverage<br> - metrics<br> - code quality<br> - code smells |

## Example usage

Once you executed the goal of each plugin.

```yaml
      uses: tupac-rocher/mvn-format-xml-reports@v2.1
      with:
        jacoco-html-report: ${{ github.workspace }}/target/site/jacoco/index.html
        ck-main-class-csv: ${{ github.workspace }}/src/main/java/class.csv
        metrics-xml: ${{ github.workspace }}/metrics.xml
        checkstyle-result-xml: ${{ github.workspace }}/target/checkstyle-result.xml
        designite-design-result-csv: ${{ github.workspace }}/target/designite/designCodeSmells.csv
        designite-implementation-result-csv: ${{ github.workspace }}/target/designite/implementationCodeSmells.csv
```

## Student-friendly pipeline explanation and context of use
[Report Documentation](https://github.com/tupac-rocher/student-friendly-pipeline-documentation)

Your project should include 2 Maven plugins in your pom.xml file:
- jacoco-maven-plugin
- maven-checkstyle-plugin

The pipeline is divided into 3 jobs:
- test
- upload-designite-artifact
- report

### test
actions used: actions/checkout@v3, actions/setup-java@v3


### upload-designite-artifact
actions used: GuillaumeFalourd/clone-github-repo-action@v2, actions/upload-artifact@v3

### report
actions used: actions/checkout@v3, actions/setup-java@v3, actions/download-artifact@v3, robinraju/release-downloader@v1.4, montudor/action-zip@v1, tupac-rocher/mvn-format-xml-reports@v2.1, thollander/actions-comment-pull-request@v1
