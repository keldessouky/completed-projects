package com.techelevator.view;

import java.util.List;
import java.util.Scanner;

import com.techelevator.Item;

public class Menu {
	private Inventory inventory;
	private Money money;

	private String title = "*********************Weyland Co. Catering*********************";

	public Menu(Money money, Inventory inventory) {

		this.money = money;
		this.inventory = inventory;

	}

	Scanner scanner = new Scanner(System.in);

	public String printMainMenu() {
		System.out.println(title);
		System.out.println("(1) Display Catering Items");
		System.out.println("(2) Order");
		System.out.println("(3) Quit");

		return scanner.nextLine();
	}

	public String printSubMenu() {
		System.out.println("(1) Add Money");
		System.out.println("(2) Select Products");
		System.out.println("(3) Complete Transaction");
		System.out.println("Current Account balance: " + money.getBalanceAsString());
		return scanner.nextLine();

	}

	public void printOrderMenu() {

		System.out.println(
				"Please type product code (Case sensitive) and amount to add to your cart (separated by space)");

	}

	public void displayInventory() {
		List<Item> itemList = inventory.getInventoryList();

		System.out.format("  %-9s", "Code");
		System.out.format("  %-20s", "Item Name");
		System.out.format("  %-9s", "Price");
		System.out.format("  %6s", "Qty");
		System.out.format("  %3s", "Category" + "\n");
		System.out.println("**************************************************************");
		for (Item item : itemList) {
			System.out.format(" |%-9s", item.getItemCode());
			System.out.format(" |%-20s", item.getItemName());
			System.out.format(" |%-9s", String.format("$%.2f", item.getItemCost()));
			System.out.format(" |%6s", item.getItemQuantity());
			System.out.format(" |%3s", item.getItemCategory());
			System.out.println();
		}
	}

}