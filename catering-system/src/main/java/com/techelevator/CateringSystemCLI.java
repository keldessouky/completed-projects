package com.techelevator;

import java.util.Scanner;

import com.techelevator.view.AuditLogger;
import com.techelevator.view.Inventory;
import com.techelevator.view.Menu;
import com.techelevator.view.Money;
import com.techelevator.view.ShoppingCart;

public class CateringSystemCLI {

	private Menu menu;
	private Inventory inventory;
	private Item item;
	private ShoppingCart cart;
	private AuditLogger logger;

	public CateringSystemCLI(Menu menu, Inventory inventory) {
		this.menu = menu;
		this.inventory = inventory;
		this.cart = new ShoppingCart();
		this.logger = new AuditLogger();
	}

	public static void main(String[] args) {

		Money money = new Money();
		Inventory inventory = new Inventory();
		Menu menu = new Menu(money, inventory);

		inventory.startUpInventory();
		CateringSystemCLI cli = new CateringSystemCLI(menu, inventory);
		cli.run(money); //
	}

	public void run(Money money) {
		boolean finished = false;
		while (!finished) {

			String answer = menu.printMainMenu();

			if (answer.equals("1")) {

				displayCateringItemsHandler();

			} else if (answer.equals("2")) {
				boolean subFinished = false;//
				while (!subFinished) {
					Scanner subAnswer = new Scanner(System.in);
					System.out.println("SUB MENU");
					System.out.println("*********************Weyland Co. Catering*********************");
					printCart();
					String input = menu.printSubMenu();

					if (input.equals("1")) {
						System.out.println("How much would you like to add?");
						Double addedMoney = Double.parseDouble(subAnswer.nextLine());
						money.increaseBalance(addedMoney);
						logger.addMoneyLog(addedMoney, money.getBalance()); // adds this information to the log.txt file

					}

					else if (input.equals("2")) {
						menu.displayInventory();
						menu.printOrderMenu();
						input = subAnswer.nextLine();
						String[] inputArray = input.split(" ");
									//create a variable for inputArray[0].toUpperCase()  AND a separate variable for inputArray[1]
						try {
							if (Integer.parseInt(inputArray[1]) <= 0) {
								System.out.println("You must request a positive amount.");
							} else if (inventory.checkAvailabilityOfItem(inputArray[0].toUpperCase(),
									Integer.parseInt(inputArray[1]))) { //
								item = inventory.getItem(inputArray[0].toUpperCase());
								double totalCost = item.getItemCost() * Integer.parseInt(inputArray[1]);
								if (money.balanceValidityCheck(totalCost)) {
									cart.cartTotal(totalCost);
									cart.addToCart(inputArray);
									item.removeItem(Integer.parseInt(inputArray[1]));
									money.decreaseBalance(totalCost);
									logger.addChargeLog(totalCost, money.getBalance());
									System.out.println("✅ You have added " + inputArray[1] + " "
											+ inventory.getItemName(inputArray[0].toUpperCase()));

								}
							} else if (item.getItemQuantity() == 0) {
								System.out.println(
										inventory.getItemName(inputArray[0].toUpperCase()) + "is OUT OF STOCK.");
							} else {
								System.out.println("Amount requested: " + inputArray[1] + ", Amount available: "
										+ item.getItemQuantity());
							}
							//

						} catch (Exception e) {
							System.out.println("❌ please enter a valid item.");
						}

					}

					else if (input.equals("3")) {
						System.out.print("Your transactions today totalled: ");
						System.out.format("$%.2f", cart.displayCartTotal());
						System.out.println();
						logger.makeChangeLog(money.getBalance());
						money.returnChange();

						System.out.println("\n" + "Thank you for choosing Weyland Co. Catering");

						subFinished = true;
					}
				}
			} else if (answer.equals("3")) {
				logger.writeToFile();
				System.out.println("Goodbye!");
				finished = true;
			} else {
				System.out.println("❌ Invalid choice, please try again!");
			}
		}
	}

	public void displayCateringItemsHandler() {
		System.out.println("You chose 1");
		System.out.println("*********************Weyland Co. Catering*********************");
		menu.displayInventory();

	}

	public void printCart() {
		System.out.println("-||Cart||-");
		for (String itemCode : cart.getKeys()) {
			String itemName = inventory.getItemName(itemCode);
			int itemQuanitityInInvnetory = inventory.getItem(itemCode).getItemQuantity();
			int quantityInCart = 50 - itemQuanitityInInvnetory;
			System.out.println(itemName + " x" + quantityInCart + " Cost: $"
					+ (quantityInCart * inventory.getItem(itemCode).getItemCost()));
		}
	}
	// understood how to better encapsulate using handlers but ran out of time to
	// properly apply above

}
