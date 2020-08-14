package com.techelevator;

public class Item {
	private double itemCost;
	private String itemName;
	private String itemCode;
	private String itemCategory;
	private int itemQuantity;

	public Item(String itemCode, String itemName, double itemCost, String itemCategory) {
		this.itemCode = itemCode;
		this.itemName = itemName;
		this.itemCost = itemCost;
		this.itemCategory = itemCategory;
		this.itemQuantity = 50;

	}

	public double getItemCost() {
		return itemCost;
	}

	public String getItemName() {

		return itemName;
	}

	public String getItemCode() {
		return itemCode;
	}

	public String getItemCategory() {

		return itemCategory;
	}

	public int getItemQuantity() {

		return itemQuantity;
	}

	public void removeItem(int amountToRemove) {

		itemQuantity -= amountToRemove;
	}

}