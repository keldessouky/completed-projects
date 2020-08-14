package com.techelevator.view;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;

import com.techelevator.Item;

public class Inventory {
	private Map<String, Item> inventoryMap;

	public void startUpInventory() {				//creates a new inventory on startup
		FileLoader fileLoader = new FileLoader();
		inventoryMap = fileLoader.fileReader();
	}

	public List<Item> getInventoryList() {				//list for inventory, set of keys, searching through
		List<Item> inventoryList = new ArrayList<>();	// the inventory map using each key, and adds existing
		Set<String> keySet = inventoryMap.keySet();		//items found using that key into inentory list
		for (String key : keySet) {							//ENCAPSULATION OF MAP IS GOOD HERE
			inventoryList.add(inventoryMap.get(key));
		}
		return inventoryList;
	}

	public boolean checkAvailabilityOfItem(String itemCode, int itemQuantity) {

		boolean result = false;								//checking to see if item is available
		if (inventoryMap.containsKey(itemCode)) {
			if (itemQuantity <= inventoryMap.get(itemCode).getItemQuantity()) {
				result = true;
			}

		}
		return result;
	}

	public String getItemName(String productId) {
		return inventoryMap.get(productId).getItemName();

	}

	public Item getItem(String productId) {
		return inventoryMap.get(productId);

	}

}