package com.techelevator.tenmo;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import com.techelevator.tenmo.models.AuthenticatedUser;
import com.techelevator.tenmo.models.TransferDetails;
import com.techelevator.tenmo.models.TransferDTO;
import com.techelevator.tenmo.models.TransferSimpleDetails;
import com.techelevator.tenmo.models.UserCredentials;
import com.techelevator.tenmo.services.AuthenticationService;
import com.techelevator.tenmo.services.AuthenticationServiceException;
import com.techelevator.tenmo.services.TransferService;
import com.techelevator.tenmo.services.UserService;
import com.techelevator.tenmo.services.UserServiceException;
import com.techelevator.view.ConsoleService;

public class App {

	private static final String API_BASE_URL = "http://localhost:8080/";

	private static final String MENU_OPTION_EXIT = "Exit";
	private static final String LOGIN_MENU_OPTION_REGISTER = "Register";
	private static final String LOGIN_MENU_OPTION_LOGIN = "Login";
	private static final String[] LOGIN_MENU_OPTIONS = { LOGIN_MENU_OPTION_REGISTER, LOGIN_MENU_OPTION_LOGIN,
			MENU_OPTION_EXIT };
	private static final String MAIN_MENU_OPTION_VIEW_BALANCE = "View your current balance";
	private static final String MAIN_MENU_OPTION_SEND_BUCKS = "Send TE bucks";
	private static final String MAIN_MENU_OPTION_VIEW_PAST_TRANSFERS = "View your past transfers";
	private static final String MAIN_MENU_OPTION_REQUEST_BUCKS = "Request TE bucks";
	private static final String MAIN_MENU_OPTION_VIEW_PENDING_REQUESTS = "View your pending requests";
	private static final String MAIN_MENU_OPTION_LOGIN = "Login as different user";
	private static final String[] MAIN_MENU_OPTIONS = { MAIN_MENU_OPTION_VIEW_BALANCE, MAIN_MENU_OPTION_SEND_BUCKS,
			MAIN_MENU_OPTION_VIEW_PAST_TRANSFERS, MAIN_MENU_OPTION_REQUEST_BUCKS,
			MAIN_MENU_OPTION_VIEW_PENDING_REQUESTS, MAIN_MENU_OPTION_LOGIN, MENU_OPTION_EXIT };

	private AuthenticatedUser currentUser;
	private ConsoleService console;
	private AuthenticationService authenticationService;
	private UserService userService;
	private TransferService transferService;

	public static void main(String[] args) {
		App app = new App(new ConsoleService(System.in, System.out), new AuthenticationService(API_BASE_URL),
				new UserService(API_BASE_URL), new TransferService(API_BASE_URL));
		app.run();
	}

	public App(ConsoleService console, AuthenticationService authenticationService, UserService userService,
			TransferService transferService) {
		this.console = console;
		this.authenticationService = authenticationService;
		this.userService = userService;
		this.transferService = transferService;
	}

	public void run() {
		System.out.println("*********************");
		System.out.println("* Welcome to TEnmo! *");
		System.out.println("*********************");

		registerAndLogin();
		mainMenu();
	}

	private void mainMenu() {
		while (true) {
			String choice = (String) console.getChoiceFromOptions(MAIN_MENU_OPTIONS);
			if (MAIN_MENU_OPTION_VIEW_BALANCE.equals(choice)) {
				viewCurrentBalance();
			} else if (MAIN_MENU_OPTION_VIEW_PAST_TRANSFERS.equals(choice)) {
				viewTransferHistory();
			} else if (MAIN_MENU_OPTION_VIEW_PENDING_REQUESTS.equals(choice)) {
				viewPendingRequests();
			} else if (MAIN_MENU_OPTION_SEND_BUCKS.equals(choice)) {
				sendBucks();
			} else if (MAIN_MENU_OPTION_REQUEST_BUCKS.equals(choice)) {
				requestBucks();
			} else if (MAIN_MENU_OPTION_LOGIN.equals(choice)) {
				login();
			} else {
				// the only other option on the main menu is to exit
				exitProgram();
			}
		}
	}

	private void viewCurrentBalance() {
		BigDecimal balance = null;
		try {
			balance = userService.getBalance();
		} catch (UserServiceException e) {
			System.out.println("BALANCE ERROR: " + e.getMessage());
			System.out.println("Please attempt to get balance again.");
		}
		console.printBalance(balance);

	}

	private void viewTransferHistory() {
		console.printTransferHistory(transferService.getTransfers());
		Integer transferId = console.getUserInputInteger("Please enter transfer ID to view details (0 to cancel)");

		if (transferId > 0) {
			TransferDetails details = transferService.getTransferDetails(transferId);
			if(details != null) console.printTransferDetails(transferService.getTransferDetails(transferId));
		}
	}

	private void viewPendingRequests() {
		TransferSimpleDetails[] transferArray = transferService.getPendingTransfers();
		if( console.printPendingRequests(transferArray)) {
			Integer transferId = console.getUserInputInteger("Please enter transfer ID to approve/reject (0 to cancel)");
			List<Integer> pendingIDs = new ArrayList<>();
			for(TransferSimpleDetails transfer: transferArray) {
				pendingIDs.add(transfer.getTransfer_id());
			}
			if(transferId == 0) {
				return;
			}
			if(!pendingIDs.contains(transferId)) {
				System.out.println("Pending Transfer Not Found");
				return;
			}
			Integer choice = console.getApproveReject();
			switch(choice) {
				case 1:
					System.out.println(transferService.approve(transferId));
					break;
				case 2:
					System.out.println(transferService.reject(transferId));
					break;
				case 0:
					System.out.println("Canceled");
					break;
				default:
					System.out.println("ERROR");
					} 
			}
	}

	private void sendBucks() {
		printUsers();
		TransferDTO newTransfer = startSendTransfer();
		if (newTransfer != null) {
			BigDecimal transferAmount = console.getUserInputPositiveBigDecimal("Enter amount");
			if(transferAmount.compareTo(BigDecimal.valueOf(0)) == 1) {
				newTransfer.setAmount(transferAmount);
				System.out.println(transferService.postNewTransfer(newTransfer));
			}
		}
	}

	private TransferDTO startSendTransfer() {
		TransferDTO newTransfer = new TransferDTO();
		Boolean isRunning = true;
		while (isRunning) {
			newTransfer.setAccount_from(currentUser.getUser().getId());
			newTransfer.setTransfer_type_id(2);
			newTransfer.setTransfer_status_id(2);
			Integer accountTo = console.getUserInputInteger("Enter ID of user you are sending to (0 to cancel)" );
			if (accountTo == 0) {
				return null;
			} else {
				newTransfer.setAccount_to(accountTo);
				isRunning = false;
			}
		}
		return newTransfer;
	}

	private void requestBucks() {
		printUsers();
		TransferDTO newTransfer = startRequestTransfer();
		if (newTransfer != null) {
			BigDecimal transferAmount = console.getUserInputPositiveBigDecimal("Enter amount");
			if(transferAmount.compareTo(BigDecimal.valueOf(0)) == 1) {
				newTransfer.setAmount(transferAmount);
				System.out.println(transferService.postNewTransfer(newTransfer));
			}
		}
	}
	
	private TransferDTO startRequestTransfer() {
		TransferDTO newTransfer = new TransferDTO();
		Boolean isRunning = true;
		while (isRunning) {
			newTransfer.setAccount_to(currentUser.getUser().getId());
			newTransfer.setTransfer_type_id(1);
			newTransfer.setTransfer_status_id(1);
			Integer accountTo = console.getUserInputInteger("Enter ID of user you are requesting from (0 to cancel)");
			if (accountTo == 0) {
				return null;
			} else {
				newTransfer.setAccount_from(accountTo);
				isRunning = false;
			}
		}
		return newTransfer;
	}

	private void exitProgram() {
		System.out.println("Goodbye!");
		System.exit(0);
	}

	private void printUsers() {
		Map<Integer, String> users = null;
		try {
			users = userService.getUsers();
		} catch (UserServiceException e) {
			System.out.println("ERROR: " + e.getMessage());
			System.out.println("Please attempt to get the users again.");
		}
		console.printUsers(users);
	}
	
	
	//Authentication Methods
	private void registerAndLogin() {
		while (!isAuthenticated()) {
			String choice = (String) console.getChoiceFromOptions(LOGIN_MENU_OPTIONS);
			if (LOGIN_MENU_OPTION_LOGIN.equals(choice)) {
				login();
			} else if (LOGIN_MENU_OPTION_REGISTER.equals(choice)) {
				register();
			} else {
				// the only other option on the login menu is to exit
				exitProgram();
			}
		}
	}
	
	private boolean isAuthenticated() {
		return currentUser != null;
	}

	private void register() {
		System.out.println("Please register a new user account");
		boolean isRegistered = false;
		while (!isRegistered) // will keep looping until user is registered
		{
			UserCredentials credentials = collectUserCredentials();
			try {
				authenticationService.register(credentials);
				isRegistered = true;
				System.out.println("Registration successful. You can now login.");
			} catch (AuthenticationServiceException e) {
				System.out.println("REGISTRATION ERROR: " + e.getMessage());
				System.out.println("Please attempt to register again.");
			}
		}
	}

	private void login() {
		System.out.println("Please log in");
		currentUser = null;
		while (currentUser == null) // will keep looping until user is logged in
		{
			UserCredentials credentials = collectUserCredentials();
			try {
				currentUser = authenticationService.login(credentials);
			} catch (AuthenticationServiceException e) {
				System.out.println("LOGIN ERROR: " + e.getMessage());
				System.out.println("Please attempt to login again.");
			}
		}
		userService.setCurrentUser(currentUser);
		transferService.setCurrentUser(currentUser);
	}

	private UserCredentials collectUserCredentials() {
		String username = console.getUserInput("Username");
		String password = console.getUserInput("Password");
		return new UserCredentials(username, password);
	}
}
