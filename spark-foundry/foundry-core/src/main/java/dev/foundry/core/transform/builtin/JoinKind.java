package dev.foundry.core.transform.builtin;

/** The join flavours a step may ask for, and what each does to nullability. */
public enum JoinKind {

    INNER("inner"),
    LEFT("left_outer"),
    RIGHT("right_outer"),
    FULL("full_outer"),
    LEFT_SEMI("left_semi"),
    LEFT_ANTI("left_anti"),
    CROSS("cross");

    private final String sparkName;

    JoinKind(String sparkName) {
        this.sparkName = sparkName;
    }

    public String sparkName() {
        return sparkName;
    }

    /** Semi and anti joins filter the left side; they contribute no columns. */
    public boolean keepsRightColumns() {
        return this != LEFT_SEMI && this != LEFT_ANTI;
    }

    /** True when rows from the left may be padded with nulls. */
    public boolean nullPadsLeft() {
        return this == RIGHT || this == FULL;
    }

    /** True when rows from the right may be padded with nulls. */
    public boolean nullPadsRight() {
        return this == LEFT || this == FULL;
    }
}
