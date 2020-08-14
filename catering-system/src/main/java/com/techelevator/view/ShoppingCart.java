package com.techelevator.view;

import java.util.HashMap;
import java.util.Map;
import java.util.Set;

public class ShoppingCart {

	private Map<String, Integer> cartMap;

	private double total = 0;

	public ShoppingCart() {

		this.cartMap = new HashMap<String, Integer>();

	}

	public Object getCartTotal() {

		double itemTotal = 0;

		return itemTotal;

	}

	public Set<String> getKeys() {
		return cartMap.keySet();
	}

	public void addToCart(String[] inputArray) {
		String itemCode = inputArray[0].toUpperCase();
		int itemQuantity = Integer.parseInt(inputArray[1]);
		if (cartMap.containsKey(itemCode)) {
			cartMap.replace(itemCode, cartMap.get(itemCode) + itemQuantity);
		} else {
			cartMap.put(itemCode, itemQuantity);
		}

	}

	public double cartTotal(double totalCost) {
		total += totalCost;
		return total;
	}

	public double displayCartTotal() {

		return total;
	}

}
