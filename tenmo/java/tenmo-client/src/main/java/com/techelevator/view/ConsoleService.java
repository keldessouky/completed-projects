package com.techelevator.view;

import java.io.InputStream;
import java.io.OutputStream;
import java.io.PrintWriter;
import java.math.BigDecimal;
import java.util.Map;
import java.util.Scanner;

import com.techelevator.tenmo.models.TransferDetails;
import com.techelevator.tenmo.models.TransferSimpleDetails;

public class ConsoleService {

	private PrintWriter out;
	private Scanner in;

	public ConsoleService(InputStream input, OutputStream output) {
		this.out = new PrintWriter(output, true);
		this.in = new Scanner(input);
	}

	public Object getChoiceFromOptions(Object[] options) {
		Object choice = null;
		while (choice == null) {
			displayMenuOptions(options);
			choice = getChoiceFromUserInput(options);
		}
		out.println();
		return choice;
	}

	private Object getChoiceFromUserInput(Object[] options) {
		Object choice = null;
		String userInput = in.nextLine();
		try {
			int selectedOption = Integer.valueOf(userInput);
			if (selectedOption > 0 && selectedOption <= options.length) {
				choice = options[selectedOption - 1];
			}
		} catch (NumberFormatException e) {
			// eat the exception, an error message will be displayed below since choice will
			// be null
		}
		if (choice == null) {
			out.println("\n*** " + userInput + " is not a valid option ***\n");
		}
		return choice;
	}

	private void displayMenuOptions(Object[] options) {
		out.println();
		for (int i = 0; i < options.length; i++) {
			int optionNum = i + 1;
			out.println(optionNum + ") " + options[i]);
		}
		out.print("\nPlease choose an option >>> ");
		out.flush();
	}

	public String getUserInput(String prompt) {
		out.print(prompt + ": ");
		out.flush();
		return in.nextLine();
	}

	public Integer getUserInputInteger(String prompt) {
		Integer result = null;
		do {
			out.print(prompt + ": ");
			out.flush();
			String userInput = in.nextLine();
			try {
				Integer input = Integer.parseInt(userInput);
				if (input >= 0) {
					result = input;
				} else {
					out.println("\n*** " + userInput + " is not valid ***\n");
				}
			} catch (NumberFormatException e) {
				out.println("\n*** " + userInput + " is not valid ***\n");
			}
		} while (result == null);
		return result;
	}
	
	public BigDecimal getUserInputPositiveBigDecimal(String prompt) {
		BigDecimal result = null;
		do {
			out.print(prompt + ": ");
			out.flush();
			String userInput = in.nextLine();
			try {
				Double amount = Double.valueOf(userInput);
				if (amount >= 0) {
					result = BigDecimal.valueOf(amount);
				}
				else {
					out.println("\n*** " + userInput + " is not valid ***\n");
				}
			} catch (NumberFormatException e) {
				out.println("\n*** " + userInput + " is not valid ***\n");
			}
		} while (result == null);
		return result;
	}

	public void printBalance(BigDecimal balance) {
		System.out.println("Your current account balance is: $" + balance);
	}

	public void printUsers(Map<Integer, String> users) {
		System.out.println("-------------------------------------------");
		System.out.println("Users");
		System.out.printf("%-12s", "ID");
		System.out.println("NAME");
		System.out.println("-------------------------------------------");
		for (Integer user_id : users.keySet()) {
			System.out.printf("%-12s", user_id);
			System.out.println(users.get(user_id));
		}
		System.out.println("---------");
	}

	public BigDecimal amountAsk() {
		System.out.print("Enter amount:");
		BigDecimal choice = null;
		String userInput = in.nextLine();
		try {
			Double amount = Double.valueOf(userInput);
			if (amount >= 0) {
				choice = BigDecimal.valueOf(amount);
			}
		} catch (NumberFormatException e) {
			// eat the exception, an error message will be displayed below since choice will
			// be null
		}
		if (choice == null) {
			out.println("\n*** " + userInput + " is not a valid option ***\n");
		}
		return choice;
	}

	public void printTransferHistory(TransferSimpleDetails[] transfers) {
		System.out.println("-------------------------------------------");
		System.out.println("Transfers");
		System.out.printf("%-12s", "ID");
		System.out.printf("%-24s", "From/To");
		System.out.println("Amount");
		System.out.println("-------------------------------------------");
		for (TransferSimpleDetails dto : transfers) {
			System.out.printf("%-12s", dto.getTransfer_id());
			System.out.printf("%-24s", dto.getFromTo() + " " + dto.getSecondParty());
			System.out.println("$" + dto.getAmount());
		}
		System.out.println("---------");

		// TODO Auto-generated method stub

	}

	public void printTransferDetails(TransferDetails details) {
		System.out.println("\n-------------------------------------------");
		System.out.println("Transfer Details");
		System.out.println("-------------------------------------------");
		System.out.println("Id: " + details.getId());
		System.out.println("From: " + details.getFrom());
		System.out.println("To: " + details.getTo());
		System.out.println("Type: " + details.getType());
		System.out.println("Status: " + details.getStatus());
		System.out.println("Amount: $" + details.getAmount());

	}

	public Boolean printPendingRequests(TransferSimpleDetails[] pendingTransfers) {
		System.out.println("-------------------------------------------");
		System.out.println("Pending Transfers");
		System.out.printf("%-12s", "ID");
		System.out.printf("%-24s", "To");
		System.out.println("Amount");
		System.out.println("-------------------------------------------");
		if(pendingTransfers == null) {
			return false;
		} else {
			for (TransferSimpleDetails dto : pendingTransfers) {
			System.out.printf("%-12s", dto.getTransfer_id());
			System.out.printf("%-24s", dto.getSecondParty());
			System.out.println("$" + dto.getAmount());
		}
		System.out.println("---------");
		}
		return true;
	}

	public Integer getApproveReject() {
		System.out.print("1: Approve \n2: Reject \n0: Don't approve or reject \n--------- \n Please choose an option: ");
		Integer choice = null;
		do {
			String userInput = in.nextLine();
			try {
				Integer amount = Integer.valueOf(userInput);
				if (amount >= 0 && amount <= 3) {
					choice = amount;
				}
				else {
					out.println("\n*** " + userInput + " is not valid ***\n");
				}
			} catch (NumberFormatException e) {
				out.println("\n*** " + userInput + " is not valid ***\n");
			}
		} while (choice == null);
		return choice;
		
	}
}
