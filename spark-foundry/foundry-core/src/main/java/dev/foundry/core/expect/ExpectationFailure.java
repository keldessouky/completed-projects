package dev.foundry.core.expect;

import java.util.List;

/** Thrown when an expectation whose action is {@code fail} was not satisfied. */
public class ExpectationFailure extends RuntimeException {

    private static final long serialVersionUID = 1L;

    private final transient List<ExpectationResult> failures;

    public ExpectationFailure(String pipeline, List<ExpectationResult> failures) {
        super(buildMessage(pipeline, failures));
        this.failures = List.copyOf(failures);
    }

    private static String buildMessage(String pipeline, List<ExpectationResult> failures) {
        StringBuilder sb = new StringBuilder("pipeline '").append(pipeline).append("' failed ")
                .append(failures.size())
                .append(failures.size() == 1 ? " expectation" : " expectations")
                .append(':');
        for (ExpectationResult failure : failures) {
            sb.append(System.lineSeparator()).append("  ").append(failure.describe());
        }
        return sb.toString();
    }

    public List<ExpectationResult> failures() {
        return failures;
    }
}
