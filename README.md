
# mvn-format-xml-reports

This action treats information from files generated by different Maven plugins. It ouputs variables of type String to visualize the information under the Markdown format.
The plugins are listed below:

- [ck-mvn-plugin](https://github.com/jazzmuesli/ck-mvn-plugin)
- [Apache Maven Checkstyle Plugin](https://maven.apache.org/plugins/maven-checkstyle-plugin/)
- [DesigniteJava](https://github.com/tushartushar/DesigniteJava)

You can use it in your Github Actions workflow.

## Inputs

| File | Description |
| - | - |
| `ck-main-class-csv` | **Required** Generated by ck-mvn-plugin. The file corresponding to the analysis of the classes in the **main folder**. |
| `ck-test-class-csv` | **Required** Generated by ck-mvn-plugin. The file corresponding to the analysis of the classes in the **test folder**. |
| `ck-main-method-csv` | **Required** Generated by ck-mvn-plugin. The file corresponding to the analysis of the methods in the **main folder**. |
| `ck-test-method-csv` | **Required** Generated by ck-mvn-plugin. The file corresponding to the analysis of the methods in the **test folder**. |
| `checkstyle-result-xml` | **Required** Generated by Apache Maven Checkstyle Plugin. The file corresponding to the analysis of **code quality**. |
| `designite-result-csv` | **Required** Generated by DesigniteJava. The file corresponding to the analysis of **code smells**. |

## Outputs

| Variable | Description |
| - | - |
| `ck-classes-comment` | A Markdown formatted table in a String variable that displays the value of the CK metrics for each **class**. |
| `ck-methods-comment` | A Markdown formatted table in a String variable that displays the value of the CK metrics for each **method**. |
|  `checkstyle-comment` | A Markdown formatted text displaying a list of **errors** with their location |
| `designite-comment` | A Markdown formatted text displaying a list of **code smells** with their location |

## Example usage

Once you executed the goal of each plugin.

```yaml
  uses: tupac-rocher/mvn-format-xml-reports@v1.6
  with:
    checkstyle-result-xml: ${{ github.workspace }}/target/checkstyle-result.xml
    designite-result-csv: ${{ github.workspace }}/target/designite/designCodeSmells.csv
    ck-main-class-csv: ${{ github.workspace }}/src/main/java/class.csv
    ck-main-method-csv: ${{ github.workspace }}/src/main/java/method.csv
    ck-test-class-csv:  ${{ github.workspace }}/src/test/java/class.csv
    ck-test-method-csv:  ${{ github.workspace }}/src/test/java/method.csv
```
