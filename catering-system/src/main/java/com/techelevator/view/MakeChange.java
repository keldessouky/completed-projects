package com.techelevator.view;

import java.util.LinkedHashMap;
import java.util.Map;

public class MakeChange {

	public void makeChange(double change) {
		Map<String, Integer> changeMap = makeChangeMap(change);
		System.out.print("Change: ");
		for (String bill : changeMap.keySet()) {
			if (changeMap.get(bill) > 0) {
				System.out.print(bill + ": " + changeMap.get(bill) + " | ");
			}
		}
		System.out.println();

	}

	private Map<String, Integer> makeChangeMap(double change) {
		Map<String, Integer> changeMap = new LinkedHashMap<String, Integer>();
		changeMap.put("Twenties", 0);
		changeMap.put("Tens", 0);
		changeMap.put("Fives", 0);
		changeMap.put("Ones", 0);
		changeMap.put("Quarters", 0);
		changeMap.put("Dimes", 0);
		changeMap.put("Nickels", 0);
		changeMap.put("Pennies", 0);

		changeMap.replace("Twenties", (int) (change / 20));
		change = change % 20;
		changeMap.replace("Tens", (int) (change / 10));
		change = change % 10;
		changeMap.replace("Fives", (int) (change / 5));
		change = change % 5;
		changeMap.replace("Ones", (int) (change / 1));
		change = change % 1;
		changeMap.replace("Quarters", (int) (change / .25));
		change = change % .25;
		changeMap.replace("Dimes", (int) (change / .10));
		change = change % .10;
		changeMap.replace("Nickels", (int) (change / .5));
		change = change % .5;
		changeMap.replace("Pennies", (int) (change / .1));
		change = change % .1;
		return changeMap;
	}


}


