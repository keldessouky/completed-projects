package com.techelevator.view;

import java.io.File;
import java.io.FileNotFoundException;
import java.io.IOException;
import java.io.PrintWriter;
import java.util.LinkedHashSet;

public class AuditLogger {

	LinkedHashSet<String> auditLog = new LinkedHashSet<String>();
	File auditFile;
	PrintWriter writer;

	public AuditLogger() {
		createFile();
	}

	private void createFile() {
		this.auditFile = new File("transactionLog.txt");
		if (auditFile.exists()) {
			auditFile.delete();
		}
		try {
			auditFile.createNewFile();
		} catch (IOException e) {
			e.printStackTrace();
		}
	}

	public void writeToFile() {
		try (PrintWriter writer = new PrintWriter(auditFile)) {
			for (String line : auditLog) {
				writer.println(line);
			}
		} catch (FileNotFoundException e) {
			e.printStackTrace();
		}
	}

	// this will take in the added money
	// resulting balance from purchase

	// Result : ADD MONEY: $10.00 $10.00
	public void addMoneyLog(double moneyAdded, double resultingBalance) {
		String log = "MONEY ADDED: $" + moneyAdded + " $" + resultingBalance;
		auditLog.add(log);
	}

	public void makeChangeLog(double changeMade) {
		String log = "CHANGE GIVEN: $" + changeMade + " $0.00";
		auditLog.add(log);
	}

	public void addChargeLog(double moneyCharged, double resultingBalance) {
		String log = "CHARGE ADDED: $" + moneyCharged + " $" + resultingBalance;
		auditLog.add(log);
	}

}
