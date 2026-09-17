package dev.foundry.core.io;

import dev.foundry.metadata.model.DatasetSpec;

import java.util.List;

/** Thrown when real data does not match the schema its dataset declares. */
public class ContractViolation extends RuntimeException {

    private static final long serialVersionUID = 1L;

    private final transient List<String> problems;
    private final String dataset;

    public ContractViolation(DatasetSpec spec, String action, String location, List<String> problems) {
        super(buildMessage(spec, action, location, problems));
        this.dataset = spec.name();
        this.problems = List.copyOf(problems);
    }

    private static String buildMessage(DatasetSpec spec, String action, String location, List<String> problems) {
        StringBuilder sb = new StringBuilder("dataset '").append(spec.name())
                .append("' does not match schema '").append(spec.schema())
                .append("' when ").append(action).append(' ').append(location)
                .append(" (enforcement: ").append(spec.enforcement().name().toLowerCase(java.util.Locale.ROOT))
                .append(')');
        for (String problem : problems) {
            sb.append(System.lineSeparator()).append("  - ").append(problem);
        }
        sb.append(System.lineSeparator()).append("  declared at ").append(spec.where().describe());
        return sb.toString();
    }

    public List<String> problems() {
        return problems;
    }

    public String dataset() {
        return dataset;
    }
}
