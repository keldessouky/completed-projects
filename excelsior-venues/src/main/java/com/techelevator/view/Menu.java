package com.techelevator.view;

import java.time.LocalDate;
import java.time.Month;

import java.util.List;
import java.util.Random;
import java.util.Scanner;

import com.techelevator.model.domain.Reservation;
import com.techelevator.model.domain.Space;
import com.techelevator.model.domain.Venue;

public class Menu {

	private Scanner scanner = new Scanner(System.in);

	private Venue venue;
	private Space space;
	private Reservation reservation;

	// constructor
	public Menu(Venue venue, Space space) {
		this.venue = venue;
		this.space = space;
	}

	// prints main menu
	public String mainMenu() {
		System.out.println("What would you like to do?");
		System.out.println("1) List Venues");
		System.out.println("Q) Quit");

		return scanner.nextLine();
	}

	// prints list of all venues
	public String viewVenues(List<Venue> venues) {
		System.out.println("Which venue would you like to view?");
		viewVenuesHandler(venues);
		System.out.println("(R) Return to Previous Screen"); // goes back to main menu
		return scanner.nextLine(); // ask user which venue they would like to view

	}

	// prints details of specified venue
	public String venueDetails(Venue venue, List<String> venueCategory) {
		displayVenueInformation(venue, venueCategory);
		System.out.println("What would you like to do next?");
		System.out.println("1) View Spaces");
		System.out.println("2) Search for Reservation - COMING SOON! ");
		System.out.println("R) Return to Previous Screen"); // goes back to view venues

		return scanner.nextLine();
	}

	// lists SPACES of specified venue
	public String listSpaces(List<Space> venueSpace) {
		venueSpaceInformationTable(venueSpace); // table header

		System.out.println("What would you like to do next?");
		System.out.println("1) Reserve a Space");
		System.out.println("R) Return to Previous Screen"); // goes back to venueDetails
		return scanner.nextLine();
	}

	public String reserveDate() {
		System.out.println("When do you need the space (YYYY-MM-DD)?"); // plus date
		String startDate = scanner.nextLine();

		return startDate;
	}

	public String endDate(String startDate, int numberOfDays) {

		LocalDate localStartDate = LocalDate.parse(startDate);
		LocalDate end_date = localStartDate.plusDays(numberOfDays);
		String endDateString = end_date.toString();

		return endDateString;
	}

	// asks user how many days will the event last
	public int daysOfAttendence() {
		System.out.println("How many days will you need the space?");
		int numberOfDays = scanner.nextInt();

		return numberOfDays;
	}

	// asks user how many people will attend
	public int numberOfAttendees() {
		System.out.println("How many people will be in attendance?");
		int numberOfAttendees = scanner.nextInt();
		scanner.nextLine(); // new line is causing issues with getting text
		return numberOfAttendees;
	}

	public void availableReservations(List<Reservation> availableReservations, int daysOfAttendence) {
		// print out availability details
		System.out.println();
		System.out.format("  %-10s", "Space #");
		System.out.format("  %-30s", "Name");
		System.out.format("  %-10s", "Daily Rate");
		System.out.format("  %-10s", "Max Occup.");
		System.out.format("  %10s", "Accessible?");
		System.out.format("  %10s", "Total Cost" + "\n");

		for (Reservation reservation : availableReservations) {
			System.out.format("  %-10s", reservation.getSpaceId());
			System.out.format("  %-30s", reservation.getSpaceName());
			System.out.format("  %-10s", "$" + reservation.getDailyRate());
			System.out.format("  %-10s", reservation.getNumberOfAttendees());
			System.out.format("  %10s", reservation.getIsAccessible());
			System.out.format("  %10s",
					"$" + reservation.calculateTotalCost(daysOfAttendence, reservation.getDailyRate()) + "\n");
		}
	}

	public long whichSpaceToReserve() {
		System.out.println("\nWhich space would you like to reserve (enter 0 to cancel)?");
		long userResponse = scanner.nextLong();
		scanner.nextLine(); // new line is causing issues with getting text
		return userResponse;
	}

	public String reservationContact() {
		System.out.println("Who is this reservation for?");
		String clientName = scanner.nextLine();

		return clientName;
	}

	public void thankYouForReservation() {
		// confirmation, venue, space, reserved for, attendees, arrival date, depart
		// date, total cost
		System.out.println("\n Thanks for submitting your reservation! The details for your event are listed below:");
	}

	private void viewVenuesHandler(List<Venue> venues) {
		int i = 1;
		for (Venue venue : venues) {
			System.out.print(i + ") ");
			System.out.format("  %10s", venue.getName() + "\n");
			i++;
		}
	}

	private void displayVenueInformation(Venue venue, List<String> venueCategory) {
		System.out.println(venue.getName());
		System.out.println("Location: " + venue.getCityName() + ", " + venue.getStateAbbreviation());
		String category = "";
		System.out.println("\nCategories: ");

		for (int i = 0; i < venueCategory.size(); i++) {
			category = venueCategory.get(i);
			System.out.println(category);
		}
		System.out.println("");
		System.out.println(venue.getDescription()); // JDBC would be a better home for this
	}

	private void venueSpaceInformationTable(List<Space> venueSpaces) {
		System.out.format("  %-10s", "ID");
		System.out.format("  %-35s", "Name");
		System.out.format("  %-8s", "Open");
		System.out.format("  %-8s", "Close");
		System.out.format("  %10s", "Daily Rate");
		System.out.format("  %10s", "Max Occupancy" + "\n");
		for (Space space : venueSpaces) {
			String openFrom = "";
			String openTo = "";
			if (space.getOpenFrom() > 0) {
				openFrom = Month.of(space.getOpenFrom()).name();
				openFrom = openFrom.substring(0, 3);
			}
			if (space.getOpenTo() > 0) {
				openTo = Month.of(space.getOpenTo()).name();
				openTo = openTo.substring(0, 3);
			}
			System.out.format("  %-10s", "#" + space.getId()); // <--- this is the ID we want, maybe
			System.out.format("  %-35s", space.getName());
			System.out.format("  %-8s", openFrom); // change numbers to month abbreviations
			System.out.format("  %-8s", openTo); // change numbers to month abbreviations
			System.out.format("  %10s", "$" + space.getDailyRate());
			System.out.format("  %10s", space.getMaxOccupancy() + "\n");
		}

	}

	public void errorMessage() {
		System.out.println("Choice is invalid, please try again.");
	}

	public String confirmationNumber() {
		Random confirmationNumber = new Random();
		int n = 10000000 + confirmationNumber.nextInt(99999999);
		String confirmationNumberString = Integer.toString(n);

		return confirmationNumberString;
	}

	public void confirmationPrinter(int daysOfAttendence, int numberOfAttendees, String venueName, String spaceName,
			String reserveDate, String endDateString, String reserveContact, double totalCost) {

		System.out.println("Confirmation #: " + confirmationNumber());
		System.out.println("Venue: " + venueName);
		System.out.println("Space: " + spaceName);
		System.out.println("Reserved for: " + reserveContact);
		System.out.println("Attendees: " + numberOfAttendees);
		System.out.println("Arrival Date: " + reserveDate);
		System.out.println("Depart Date: " + endDateString);
		System.out.println("Total Cost: $" + totalCost);

	}

}
