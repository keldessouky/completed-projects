package dev.foundry.core.run;

import java.util.List;

/**
 * Thrown when a step did not produce what the planner said it would.
 *
 * <p>This should never happen in a working framework, and that is precisely why
 * it is checked on every step of every run. A transform's planning logic and its
 * execution logic are two descriptions of the same thing; if they ever disagree,
 * every static guarantee built on the first one is worthless. Better to stop
 * loudly, naming the step and the column, than to write data whose shape nobody
 * predicted.
 */
public class PlanViolation extends RuntimeException {

    private static final long serialVersionUID = 1L;

    private final transient List<String> problems;
    private final String step;

    public PlanViolation(String step, String transformType, List<String> problems) {
        super(buildMessage(step, transformType, problems));
        this.step = step;
        this.problems = List.copyOf(problems);
    }

    private static String buildMessage(String step, String transformType, List<String> problems) {
        StringBuilder sb = new StringBuilder("step '").append(step).append("' (")
                .append(transformType).append(") did not produce what the plan predicted:");
        for (String problem : problems) {
            sb.append(System.lineSeparator()).append("  - ").append(problem);
        }
        sb.append(System.lineSeparator())
          .append("  this is a defect in the '").append(transformType)
          .append("' transform: its plan() and execute() disagree");
        return sb.toString();
    }

    public List<String> problems() {
        return problems;
    }

    public String step() {
        return step;
    }
}
